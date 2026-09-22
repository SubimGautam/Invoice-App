const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { notifyWorkspace } = require('../lib/notify');

const router = express.Router();
router.use(requireAuth);

const itemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  productId: z.string().uuid('A valid product is required').optional()
});

const invoiceSchema = z.object({
  clientId: z.string().uuid('A valid client is required'),
  issueDate: z.string().datetime().or(z.string().min(1)),
  dueDate: z.string().datetime().or(z.string().min(1)),
  notes: z.string().optional(),
  discount: z.number().nonnegative('Discount cannot be negative').optional(),
  status: z.enum(['draft', 'pending']).optional().default('draft'),
  items: z.array(itemSchema).min(1, 'At least one line item is required')
});

// Atomic per-workspace invoice numbering (WorkspaceSettings.nextInvoiceNumber).
const generateInvoiceNumber = require('../lib/invoicenumber');

const STATUS_LABEL = { draft: 'Draft', pending: 'Sent', partially_paid: 'Partially Paid', paid: 'Paid' };

// --- Money helpers ----------------------------------------------------------
// Shared module — see lib/money.js. Every dollar figure in the app is derived
// from line items + discount (there's no stored "total" column), so all money
// math lives in one place to keep the client and the API consistent.
const { invoiceTotal, paidSum, MONEY_EPSILON } = require('../lib/money');

// GET /api/invoices — list invoices, optional ?status=draft|pending|partially_paid|paid|overdue filter
router.get('/', async (req, res) => {
  const { status } = req.query;

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const where = { workspaceId: req.workspaceId };
  if (status) {
    const validStatuses = ['draft', 'pending', 'partially_paid', 'paid', 'overdue'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }
    if (status === 'overdue') {
      // Overdue = any OPEN invoice past its due date (pending OR partially
      // paid) — matches the KPI count on the dashboard.
      where.status = { in: ['pending', 'partially_paid'] };
      where.dueDate = { lt: new Date() };
    } else {
      where.status = status;
    }
  }

  const [invoices, totalCount, settings] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        client: true,
        items: true,
        payments: { select: { amount: true, paymentDate: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.invoice.count({ where }),
    prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } })
  ]);

  const taxRate = Number(settings.defaultTaxRate || 0);

  // Attach computed totals + payments-so-far so the UI can show a paid/remaining
  // state (e.g. "Partially Paid") without re-deriving money math on the client.
  const withTotals = invoices.map((inv) => ({
    ...inv,
    total: invoiceTotal(inv, taxRate),
    paid: paidSum(inv.payments)
  }));

  res.json({
    invoices: withTotals,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  });
});

// GET /api/invoices/stats — real counts + dollar totals across ALL invoices, not just one page
router.get('/stats', async (req, res) => {
  const [settings, invoices] = await Promise.all([
    prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } }),
    prisma.invoice.findMany({
      where: { workspaceId: req.workspaceId },
      select: {
        status: true,
        dueDate: true,
        discount: true,
        items: { select: { quantity: true, unitPrice: true } },
        payments: { select: { amount: true, paymentDate: true } }
      }
    })
  ]);

  const taxRate = Number(settings.defaultTaxRate || 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const counts = { all: 0, draft: 0, pending: 0, partiallyPaid: 0, paid: 0, overdue: 0 };
  const sums = { totalOutstanding: 0, paidThisMonth: 0, overdueTotal: 0, draftsTotal: 0 };

  for (const inv of invoices) {
    const total = invoiceTotal(inv, taxRate);
    const paid = paidSum(inv.payments);
    const remaining = Math.max(0, total - paid);
    const isPaid = inv.status === 'paid' || (total > 0 && paid >= total - MONEY_EPSILON);
    const isDraft = inv.status === 'draft';
    const isOverdue = !isPaid && !isDraft && new Date(inv.dueDate) < now;

    counts.all++;

    if (isDraft) {
      counts.draft++;
      sums.draftsTotal += total;
    } else if (isPaid) {
      counts.paid++;
    } else {
      // Open invoice — what's still owed after any partial payments.
      sums.totalOutstanding += remaining;
      if (paid > 0) {
        counts.partiallyPaid++;
      } else {
        counts.pending++;
      }
      if (isOverdue) {
        counts.overdue++;
        sums.overdueTotal += remaining;
      }
    }

    // "Paid this month" comes from actual payment records, not from invoice
    // status — an invoice paid at any point still surfaces the payment date.
    for (const p of inv.payments) {
      if (new Date(p.paymentDate) >= monthStart) {
        sums.paidThisMonth += Number(p.amount);
      }
    }
  }

  res.json({ counts, sums });
});

// GET /api/invoices/timeline — monthly "invoiced vs collected" series for the
// last N months (default 6). Invoiced = non-draft invoices created that month;
// collected = payments received that month. Powers the Settlement Timeline
// chart on the dashboard. Registered before /:id so "timeline" isn't parsed as
// an invoice id.
router.get('/timeline', async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months) || 6, 1), 24);
  const [settings, invoices] = await Promise.all([
    prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } }),
    prisma.invoice.findMany({
      where: { workspaceId: req.workspaceId },
      select: {
        status: true,
        createdAt: true,
        discount: true,
        items: { select: { quantity: true, unitPrice: true } },
        payments: { select: { amount: true, paymentDate: true } }
      }
    })
  ]);
  const taxRate = Number(settings.defaultTaxRate || 0);

  // Buckets oldest -> newest (last `months` months, current month included).
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString('en-US', { month: 'short' }),
      year: d.getFullYear(),
      issuedCount: 0,
      issuedSum: 0,
      collectedCount: 0,
      collectedSum: 0
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const monthKey = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  for (const inv of invoices) {
    if (inv.status !== 'draft') {
      const bucket = byKey.get(monthKey(inv.createdAt));
      if (bucket) {
        bucket.issuedCount++;
        bucket.issuedSum += invoiceTotal(inv, taxRate);
      }
    }
    for (const p of inv.payments) {
      const bucket = byKey.get(monthKey(p.paymentDate));
      if (bucket) {
        bucket.collectedCount++;
        bucket.collectedSum += Number(p.amount);
      }
    }
  }

  res.json({ months: buckets });
});

// GET /api/invoices/:id — single invoice with client, items, payments, and its real audit trail
router.get('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      client: true,
      items: true,
      payments: true,
      auditLogs: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (!invoice || invoice.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });
  const taxRate = Number(settings.defaultTaxRate || 0);

  res.json({
    ...invoice,
    total: invoiceTotal(invoice, taxRate),
    paid: paidSum(invoice.payments)
  });
});

// POST /api/invoices — create invoice + line items together (staff+)
router.post('/', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { clientId, issueDate, dueDate, notes, status, discount, items } = parsed.data;

  // Confirm the client belongs to this user before attaching an invoice to it
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });
  const taxRate = Number(settings.defaultTaxRate || 0);

  // A discount bigger than the goods themselves doesn't make sense.
  const subtotal = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0);
  if ((discount ?? 0) > subtotal) {
    return res.status(400).json({ error: 'Discount cannot exceed the subtotal' });
  }

  // Self-healing: if a leftover/legacy invoiceNumber still collides (e.g. old
  // data created under the previous count-based scheme), skip forward and
  // retry rather than 500ing. Once nextInvoiceNumber is ahead of everything
  // in the table this loop always succeeds on the first try.
  let invoice;
  for (let attempt = 0; attempt < 5; attempt++) {
    const invoiceNumber = await generateInvoiceNumber(req.workspaceId);
    try {
      invoice = await prisma.invoice.create({
        data: {
          workspaceId: req.workspaceId,
          userId: req.userId,
          clientId,
          invoiceNumber,
          status,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          discount: discount ?? 0,
          notes,
          items: {
            create: items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              productId: item.productId || null
            }))
          },
          auditLogs: {
            create: {
              type: 'created',
              message: `Invoice created as ${STATUS_LABEL[status]}`
            }
          }
        },
        include: { client: true, items: true, auditLogs: true }
      });
      break; // success
    } catch (err) {
      const isDuplicateInvoiceNumber = err.code === 'P2002' && err.meta?.target?.includes('invoiceNumber');
      if (!isDuplicateInvoiceNumber || attempt === 4) throw err;
      // otherwise loop again — generateInvoiceNumber() will hand out the next number
    }
  }

  await notifyWorkspace({
    workspaceId: req.workspaceId,
    excludeUserId: req.userId,
    type: 'invoice_created',
    title: 'New invoice',
    message: `${invoice.invoiceNumber} created for ${invoice.client.name}`,
    invoiceId: invoice.id
  });

  res.status(201).json({
    ...invoice,
    total: invoiceTotal(invoice, taxRate),
    paid: 0
  });
});

// PUT /api/invoices/:id — update invoice + replace line items (staff+)
router.put('/:id', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  // Scope by WORKSPACE, not creator: in a team workspace any staff+ member
  // edits any draft/sent invoice, and a multi-workspace user must never be able
  // to touch invoices outside the active workspace.
  if (!existing || existing.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (existing.status === 'paid' || existing.status === 'partially_paid') {
    return res.status(400).json({ error: 'Invoices with recorded payments cannot be edited' });
  }

  const { clientId, issueDate, dueDate, notes, status, discount, items } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });
  const taxRate = Number(settings.defaultTaxRate || 0);

  const subtotal = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0);
  if ((discount ?? 0) > subtotal) {
    return res.status(400).json({ error: 'Discount cannot exceed the subtotal' });
  }

  // Replace items: delete old ones, create the new set, in a single transaction
  const [, , updated] = await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } }),
    prisma.invoice.update({
      where: { id: existing.id },
      data: {
        clientId,
        status,
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        discount: discount ?? existing.discount,
        notes
      }
    }),
    prisma.invoice.update({
      where: { id: existing.id },
      data: {
        items: {
          create: items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productId: item.productId || null
          }))
        },
        auditLogs: {
          create: {
            type: 'updated',
            message: 'Invoice details and line items updated'
          }
        }
      },
      include: { client: true, items: true }
    })
  ]);

  res.json({
    ...updated,
    total: invoiceTotal(updated, taxRate),
    // Editable invoices are draft/sent only (payments block edits), so paid is always 0 here.
    paid: 0
  });
});

// PATCH /api/invoices/:id/status — move a draft to sent (pending), or mark a
// sent/partially-paid invoice as paid. Marking it paid also records a payment
// for the remaining balance so the payment history stays complete. (staff+)
router.patch('/:id/status', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const statusSchema = z.object({
    status: z.enum(['draft', 'pending', 'partially_paid', 'paid'])
  });

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  // Only these transitions make sense:
  //   draft          -> pending      (send the invoice)
  //   pending        -> paid         (full payment recorded)
  //   partially_paid -> paid         (final payment recorded)
  const allowedTransitions = {
    draft: ['pending'],
    pending: ['paid'],
    partially_paid: ['paid'],
    paid: []
  };

  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { items: true, payments: true }
  });
  if (!invoice || invoice.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (!allowedTransitions[invoice.status].includes(parsed.data.status)) {
    return res.status(400).json({
      error: `Cannot change status from ${STATUS_LABEL[invoice.status]} to ${STATUS_LABEL[parsed.data.status]}`
    });
  }

  const updateData = { status: parsed.data.status };
  if (parsed.data.status === 'paid') {
    updateData.paidAt = new Date();
  }

  const logMessage =
    parsed.data.status === 'paid'
      ? `Marked as paid (${STATUS_LABEL[invoice.status]})`
      : `Status changed from ${STATUS_LABEL[invoice.status]} to ${STATUS_LABEL[parsed.data.status]}`;

  // When marking as paid via this shortcut, backfill a payment record for the
  // remaining balance so customer balances and reports see the cash.
  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });
  const total = invoiceTotal(invoice, Number(settings.defaultTaxRate || 0));
  const paid = paidSum(invoice.payments);
  const remaining = Math.max(0, total - paid);
  const paymentsToRecord = parsed.data.status === 'paid' && remaining > MONEY_EPSILON
    ? [{ amount: remaining, method: 'Other', reference: 'Marked as paid', paymentDate: new Date() }]
    : [];

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      ...updateData,
      ...(paymentsToRecord.length
        ? { payments: { create: paymentsToRecord } }
        : {}),
      auditLogs: {
        create: {
          type: parsed.data.status === 'paid' ? 'payment' : 'status_changed',
          message: logMessage
        }
      }
    },
    include: { client: true, items: true, payments: true, auditLogs: { orderBy: { createdAt: 'desc' } } }
  });

  if (parsed.data.status === 'paid') {
    await notifyWorkspace({
      workspaceId: req.workspaceId,
      excludeUserId: req.userId,
      type: 'invoice_paid',
      title: 'Invoice paid',
      message: `${updated.invoiceNumber} marked as paid`,
      invoiceId: updated.id
    });
  }

  res.json({
    ...updated,
    total,
    paid: paidSum(updated.payments)
  });
});

// DELETE /api/invoices/:id (owner/admin only — destructive)
router.delete('/:id', requireRole('owner', 'admin'), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice || invoice.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  await prisma.invoice.delete({ where: { id: invoice.id } });
  res.status(204).send();
});

module.exports = router;