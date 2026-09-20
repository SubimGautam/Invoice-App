const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const itemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative')
});

const invoiceSchema = z.object({
  clientId: z.string().uuid('A valid client is required'),
  issueDate: z.string().datetime().or(z.string().min(1)),
  dueDate: z.string().datetime().or(z.string().min(1)),
  notes: z.string().optional(),
  status: z.enum(['draft', 'pending']).optional().default('draft'),
  items: z.array(itemSchema).min(1, 'At least one line item is required')
});

// Helper: generate a unique invoice number per user using an atomic counter.
// Using prisma.invoice.count() here was the old approach, but it recomputes
// the "next" number from how many invoices currently exist — which collides
// as soon as an invoice is deleted, two requests land close together, or the
// count just doesn't match reality anymore. UserSettings.nextInvoiceNumber
// exists specifically to avoid that: each call atomically increments it, so
// two concurrent requests can never get the same value.
async function generateInvoiceNumber(userId) {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });

  const updated = await prisma.userSettings.update({
    where: { userId },
    data: { nextInvoiceNumber: { increment: 1 } }
  });

  const numberToUse = updated.nextInvoiceNumber - 1;
  return `${settings.invoicePrefix}${String(numberToUse).padStart(4, '0')}`;
}

const STATUS_LABEL = { draft: 'Draft', pending: 'Sent', partially_paid: 'Partially Paid', paid: 'Paid' };

// --- Money helpers ----------------------------------------------------------
// Every dollar figure in the app is derived from line items (there's no stored
// "total" column), so all money math lives here on the server to keep the
// client and the API consistent.
function invoiceSubtotal(invoiceOrItems) {
  const items = invoiceOrItems.items || invoiceOrItems;
  return items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
}

// The taxed invoice total — the number printed on the invoice and PDF.
function invoiceTotal(invoiceOrItems, taxRate) {
  return invoiceSubtotal(invoiceOrItems) * (1 + (Number(taxRate) || 0) / 100);
}

function paidSum(payments) {
  return (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
}

const MONEY_EPSILON = 0.001;

// GET /api/invoices — list invoices, optional ?status=draft|pending|partially_paid|paid|overdue filter
router.get('/', async (req, res) => {
  const { status } = req.query;

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const where = { userId: req.userId };
  if (status) {
    const validStatuses = ['draft', 'pending', 'partially_paid', 'paid', 'overdue'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }
    if (status === 'overdue') {
      where.status = 'pending';
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
    prisma.userSettings.upsert({ where: { userId: req.userId }, update: {}, create: { userId: req.userId } })
  ]);

  const taxRate = Number(settings.defaultTaxRate || 0);

  // Attach computed totals + payments-so-far so the UI can show a paid/remaining
  // state (e.g. "Partially Paid") without re-deriving money math on the client.
  const withTotals = invoices.map((inv) => ({
    ...inv,
    total: invoiceTotal(inv.items, taxRate),
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
    prisma.userSettings.upsert({ where: { userId: req.userId }, update: {}, create: { userId: req.userId } }),
    prisma.invoice.findMany({
      where: { userId: req.userId },
      select: {
        status: true,
        dueDate: true,
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
    const total = invoiceTotal(inv.items, taxRate);
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

  if (!invoice || invoice.userId !== req.userId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  const settings = await prisma.userSettings.upsert({ where: { userId: req.userId }, update: {}, create: { userId: req.userId } });
  const taxRate = Number(settings.defaultTaxRate || 0);

  res.json({
    ...invoice,
    total: invoiceTotal(invoice.items, taxRate),
    paid: paidSum(invoice.payments)
  });
});

// POST /api/invoices — create invoice + line items together
router.post('/', async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { clientId, issueDate, dueDate, notes, status, items } = parsed.data;

  // Confirm the client belongs to this user before attaching an invoice to it
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.userId !== req.userId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const settings = await prisma.userSettings.upsert({ where: { userId: req.userId }, update: {}, create: { userId: req.userId } });
  const taxRate = Number(settings.defaultTaxRate || 0);

  // Self-healing: if a leftover/legacy invoiceNumber still collides (e.g. old
  // data created under the previous count-based scheme), skip forward and
  // retry rather than 500ing. Once nextInvoiceNumber is ahead of everything
  // in the table this loop always succeeds on the first try.
  let invoice;
  for (let attempt = 0; attempt < 5; attempt++) {
    const invoiceNumber = await generateInvoiceNumber(req.userId);
    try {
      invoice = await prisma.invoice.create({
        data: {
          userId: req.userId,
          clientId,
          invoiceNumber,
          status,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          notes,
          items: {
            create: items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice
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

  res.status(201).json({
    ...invoice,
    total: invoiceTotal(invoice.items, taxRate),
    paid: 0
  });
});

// PUT /api/invoices/:id — update invoice + replace line items
router.put('/:id', async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (existing.status === 'paid' || existing.status === 'partially_paid') {
    return res.status(400).json({ error: 'Invoices with recorded payments cannot be edited' });
  }

  const { clientId, issueDate, dueDate, notes, status, items } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.userId !== req.userId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const settings = await prisma.userSettings.upsert({ where: { userId: req.userId }, update: {}, create: { userId: req.userId } });
  const taxRate = Number(settings.defaultTaxRate || 0);

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
            unitPrice: item.unitPrice
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
    total: invoiceTotal(updated.items, taxRate),
    // Editable invoices are draft/sent only (payments block edits), so paid is always 0 here.
    paid: 0
  });
});

// PATCH /api/invoices/:id/status — move a draft to sent (pending), or mark a
// sent/partially-paid invoice as paid. Marking it paid also records a payment
// for the remaining balance so the payment history stays complete.
router.patch('/:id/status', async (req, res) => {
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
  if (!invoice || invoice.userId !== req.userId) {
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
  const settings = await prisma.userSettings.upsert({ where: { userId: req.userId }, update: {}, create: { userId: req.userId } });
  const total = invoiceTotal(invoice.items, Number(settings.defaultTaxRate || 0));
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

  res.json({
    ...updated,
    total,
    paid: paidSum(updated.payments)
  });
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice || invoice.userId !== req.userId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  await prisma.invoice.delete({ where: { id: invoice.id } });
  res.status(204).send();
});

module.exports = router;