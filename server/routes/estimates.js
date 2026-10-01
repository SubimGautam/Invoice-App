const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { notifyWorkspace } = require('../lib/notify');
const generateEstimateNumber = require('../lib/estimatenumber');
const generateInvoiceNumber = require('../lib/invoicenumber');
const { generatePaymentToken } = require('../lib/paymenttoken');
// Same money math as invoices — lib/money.js only needs { items, discount }, so
// an estimate totals with identical code (discount before tax).
const { invoiceTotal, itemsSubtotal } = require('../lib/money');

const router = express.Router();
router.use(requireAuth);

const itemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  productId: z.string().uuid('A valid product is required').optional(),
  // Per-line tax rate; absent/null inherits the workspace default. An estimate
  // has to carry the same mixed rates as the invoice it becomes, or converting
  // would silently restate the tax the client already agreed to.
  taxRate: z.number().nonnegative('Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100').nullable().optional()
});

const estimateSchema = z.object({
  clientId: z.string().uuid('A valid client is required'),
  issueDate: z.string().datetime().or(z.string().min(1)),
  validUntil: z.string().datetime().or(z.string().min(1)),
  notes: z.string().optional(),
  discount: z.number().nonnegative('Discount cannot be negative').optional(),
  status: z.enum(['draft', 'sent']).optional().default('draft'),
  items: z.array(itemSchema).min(1, 'At least one line item is required')
});

const STATUS_LABEL = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', converted: 'Converted' };

// A converted estimate is a historical record of what the client agreed to —
// the invoice is the document of record from that point on, so edits are locked.
function isLocked(estimate) {
  return estimate.status === 'converted';
}

function includeFor() {
  return { client: true, items: true, auditLogs: { orderBy: { createdAt: 'asc' } } };
}

// GET /api/estimates — list, optional ?status= & ?q= (number or client name)
router.get('/', async (req, res) => {
  const { status, q } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const where = { workspaceId: req.workspaceId };
  if (status) {
    const valid = ['draft', 'sent', 'accepted', 'declined', 'converted'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status filter' });
    where.status = status;
  }
  if (q && q.trim()) {
    where.OR = [
      { estimateNumber: { contains: q.trim(), mode: 'insensitive' } },
      { client: { name: { contains: q.trim(), mode: 'insensitive' } } },
      { client: { companyName: { contains: q.trim(), mode: 'insensitive' } } }
    ];
  }

  const [estimates, totalCount, settings] = await Promise.all([
    prisma.estimate.findMany({
      where,
      include: { client: true, items: true, invoice: { select: { id: true, invoiceNumber: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.estimate.count({ where }),
    prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } })
  ]);

  const taxRate = Number(settings.defaultTaxRate || 0);

  res.json({
    estimates: estimates.map((e) => ({ ...e, total: invoiceTotal(e, taxRate) })),
    pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) }
  });
});

// GET /api/estimates/:id — full detail + audit trail
router.get('/:id', async (req, res) => {
  const estimate = await prisma.estimate.findUnique({
    where: { id: req.params.id },
    // `total` is derived (items + discount + tax), not a column — the client
    // links to the invoice page, which computes its own total.
    include: { ...includeFor(), invoice: { select: { id: true, invoiceNumber: true, status: true } } }
  });
  if (!estimate || estimate.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Estimate not found' });
  }

  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });
  res.json({ ...estimate, total: invoiceTotal(estimate, Number(settings.defaultTaxRate || 0)) });
});

// GET /api/estimates/:id/link — the public quote link (no account needed for
// the client). Generates a token on demand so every estimate has a working link.
router.get('/:id/link', async (req, res) => {
  const estimate = await prisma.estimate.findUnique({ where: { id: req.params.id } });
  if (!estimate || estimate.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Estimate not found' });
  }
  let token = estimate.viewToken;
  if (!token) {
    token = generatePaymentToken();
    await prisma.estimate.update({ where: { id: estimate.id }, data: { viewToken: token } });
  }
  const base = process.env.CLIENT_URL || 'http://localhost:5173';
  res.json({ url: `${base}/q/${token}` });
});

// POST /api/estimates — create (staff+)
router.post('/', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = estimateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { clientId, issueDate, validUntil, notes, status, discount, items } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  if (new Date(validUntil) < new Date(issueDate)) {
    return res.status(400).json({ error: 'Valid-until date cannot be before the issue date' });
  }

  const subtotal = itemsSubtotal(items);
  if ((discount ?? 0) > subtotal) {
    return res.status(400).json({ error: 'Discount cannot exceed the subtotal' });
  }

  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });

  // Self-healing on a rare number collision (see invoices.js — same pattern).
  let estimate;
  for (let attempt = 0; attempt < 5; attempt++) {
    const estimateNumber = await generateEstimateNumber(req.workspaceId);
    try {
      estimate = await prisma.estimate.create({
        data: {
          workspaceId: req.workspaceId,
          userId: req.userId,
          clientId,
          estimateNumber,
          status,
          viewToken: generatePaymentToken(),
          issueDate: new Date(issueDate),
          validUntil: new Date(validUntil),
          discount: discount ?? 0,
          notes,
          items: {
            create: items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              productId: item.productId || null,
              taxRate: item.taxRate ?? null
            }))
          },
          auditLogs: { create: { type: 'created', message: `Estimate created as ${STATUS_LABEL[status]}` } }
        },
        include: includeFor()
      });
      break;
    } catch (err) {
      const isDup = err.code === 'P2002' && err.meta?.target?.includes('estimateNumber');
      if (!isDup || attempt === 4) throw err;
    }
  }

  await notifyWorkspace({
    workspaceId: req.workspaceId,
    excludeUserId: req.userId,
    type: 'estimate_created',
    title: 'New estimate',
    message: `${estimate.estimateNumber} created for ${estimate.client.name}`,
    estimateId: estimate.id
  });

  res.status(201).json({ ...estimate, total: invoiceTotal(estimate, Number(settings.defaultTaxRate || 0)) });
});

// PUT /api/estimates/:id — replace fields + line items (staff+)
router.put('/:id', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = estimateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const existing = await prisma.estimate.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Estimate not found' });
  }
  if (isLocked(existing)) {
    return res.status(400).json({ error: 'Converted estimates cannot be edited — edit the invoice instead' });
  }

  const { clientId, issueDate, validUntil, notes, status, discount, items } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Client not found' });
  }
  if (new Date(validUntil) < new Date(issueDate)) {
    return res.status(400).json({ error: 'Valid-until date cannot be before the issue date' });
  }

  const subtotal = itemsSubtotal(items);
  if ((discount ?? 0) > subtotal) {
    return res.status(400).json({ error: 'Discount cannot exceed the subtotal' });
  }

  // sent -> draft is a "revert to editing" move; anything else keeps the
  // client's answer visible. Editing an accepted/declined quote is legitimate
  // (you revised the price and they re-accepted), but we keep the recorded
  // answer until it's explicitly changed via /status.
  const nextStatus = status === 'draft' ? 'draft' : existing.status === 'draft' ? 'sent' : existing.status;

  const [, updated] = await prisma.$transaction([
    prisma.estimateItem.deleteMany({ where: { estimateId: existing.id } }),
    prisma.estimate.update({
      where: { id: existing.id },
      data: {
        clientId,
        status: nextStatus,
        issueDate: new Date(issueDate),
        validUntil: new Date(validUntil),
        discount: discount ?? existing.discount,
        notes,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            productId: item.productId || null,
            taxRate: item.taxRate ?? null
          }))
        },
        auditLogs: { create: { type: 'updated', message: 'Estimate details and line items updated' } }
      },
      include: includeFor()
    })
  ]);

  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });
  res.json({ ...updated, total: invoiceTotal(updated, Number(settings.defaultTaxRate || 0)) });
});

// PATCH /api/estimates/:id/status — record the client's answer, or send it.
//   sent     : staff is handing the quote over (also stamps sentAt)
//   accepted : the client said yes
//   declined : the client said no (optionally with a reason)
//   draft    : revert to editing
// (staff+)
router.patch('/:id/status', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const schema = z.object({
    status: z.enum(['draft', 'sent', 'accepted', 'declined']),
    reason: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status' });

  const estimate = await prisma.estimate.findUnique({ where: { id: req.params.id } });
  if (!estimate || estimate.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Estimate not found' });
  }
  if (isLocked(estimate)) {
    return res.status(400).json({ error: 'This estimate was converted to an invoice and can no longer change' });
  }

  const { status, reason } = parsed.data;
  const now = new Date();
  const data = { status, declinedReason: null };
  const logType = { sent: 'sent', accepted: 'accepted', declined: 'declined', draft: 'updated' }[status];

  if (status === 'sent') {
    data.sentAt = estimate.sentAt || now;
  } else if (status === 'accepted') {
    data.acceptedAt = now;
    // Accepting clears any earlier decline, and vice versa.
    data.declinedAt = null;
  } else if (status === 'declined') {
    data.declinedAt = now;
    data.acceptedAt = null;
    data.declinedReason = reason?.trim() || null;
  }

  const updated = await prisma.estimate.update({
    where: { id: estimate.id },
    data: {
      ...data,
      auditLogs: {
        create: {
          type: logType,
          message:
            status === 'declined'
              ? `Estimate declined${reason?.trim() ? `: ${reason.trim()}` : ''}`
              : `Estimate marked ${STATUS_LABEL[status].toLowerCase()}`
        }
      }
    },
    include: includeFor()
  });

  // Tell the team when a client answers — this is the event everyone is
  // waiting on, and it has no email behind it, so the feed is the only signal.
  if (status === 'accepted' || status === 'declined') {
    await notifyWorkspace({
      workspaceId: req.workspaceId,
      excludeUserId: req.userId,
      type: status === 'accepted' ? 'estimate_accepted' : 'estimate_declined',
      title: `Estimate ${STATUS_LABEL[status].toLowerCase()}`,
      message: `${estimate.estimateNumber} was ${status} by ${estimate.client?.name || 'the client'}`,
      estimateId: estimate.id
    });
  }

  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });
  res.json({ ...updated, total: invoiceTotal(updated, Number(settings.defaultTaxRate || 0)) });
});

// POST /api/estimates/:id/convert — turn an accepted quote into a real invoice.
//
// This is the whole point of the feature: the client already agreed to a price,
// so the invoice must inherit the exact line items, quantities, prices and
// discount rather than be retyped. Payment terms come from the workspace
// settings. The invoice starts as a DRAFT so the user reviews it before it goes
// out — converting is not the same as sending.
// (staff+)
router.post('/:id/convert', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  // `invoice` is the back-reference (Invoice.estimateId is the unique FK). The
  // unique constraint is the real guarantee that one quote can never become two
  // invoices, but checking it here turns a race into a clear 400 instead of a 500.
  const estimate = await prisma.estimate.findUnique({
    where: { id: req.params.id },
    include: { client: true, items: true, invoice: { select: { id: true, invoiceNumber: true } } }
  });
  if (!estimate || estimate.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Estimate not found' });
  }
  if (estimate.invoice) {
    return res.status(400).json({ error: `This estimate has already been converted to invoice ${estimate.invoice.invoiceNumber}` });
  }
  if (estimate.status === 'declined') {
    return res.status(400).json({ error: 'A declined estimate cannot be converted' });
  }
  if (estimate.status === 'draft') {
    return res.status(400).json({ error: 'Send this estimate to the client before converting it' });
  }

  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });
  const taxRate = Number(settings.defaultTaxRate || 0);

  const issueDate = new Date();
  issueDate.setHours(0, 0, 0, 0);
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + Number(settings.defaultPaymentTerms || 30));

  // Number collision retry, same as invoice creation.
  let invoice;
  for (let attempt = 0; attempt < 5; attempt++) {
    const invoiceNumber = await generateInvoiceNumber(req.workspaceId);
    try {
      // One transaction so the estimate can never end up converted-but-
      // invoice-missing (or the reverse) if the invoice insert fails.
      [invoice] = await prisma.$transaction([
        prisma.invoice.create({
          data: {
            workspaceId: req.workspaceId,
            userId: estimate.userId,
            clientId: estimate.clientId,
            invoiceNumber,
            status: 'draft',
            paymentToken: generatePaymentToken(),
            issueDate,
            dueDate,
            discount: estimate.discount,
            notes: estimate.notes,
            estimateId: estimate.id,
            items: {
              create: estimate.items.map((it) => ({
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                productId: it.productId || null,
                taxRate: it.taxRate ?? null
              }))
            },
            auditLogs: { create: { type: 'created', message: `Created from estimate ${estimate.estimateNumber}` } }
          },
          // Return the copied lines so the response is a usable invoice object
          // (and its total can be computed from real rows, not from the source).
          include: { items: true }
        }),
        prisma.estimate.update({
          where: { id: estimate.id },
          data: {
            status: 'converted',
            acceptedAt: estimate.acceptedAt || new Date(),
            auditLogs: { create: { type: 'converted', message: `Converted to invoice ${invoiceNumber}` } }
          }
        })
      ]);
      break;
    } catch (err) {
      // Two different unique constraints can fire here. A number collision just
      // means "burn a number and try again"; losing the estimateId race means
      // somebody else already converted this quote, which no retry can fix.
      if (err.code === 'P2002' && err.meta?.target?.includes('estimateId')) {
        return res.status(400).json({ error: 'This estimate has already been converted to an invoice' });
      }
      const isDup = err.code === 'P2002' && err.meta?.target?.includes('invoiceNumber');
      if (!isDup || attempt === 4) throw err;
    }
  }

  await notifyWorkspace({
    workspaceId: req.workspaceId,
    excludeUserId: req.userId,
    type: 'estimate_converted',
    title: 'Estimate converted',
    message: `${estimate.estimateNumber} became invoice ${invoice.invoiceNumber}`,
    // Link to the NEW invoice — that's where the money now lives.
    invoiceId: invoice.id
  });

  res.status(201).json({ ...invoice, total: invoiceTotal(invoice, taxRate) });
});

// DELETE /api/estimates/:id (staff+). Converted estimates are protected: they
// are the audit trail of what a client agreed to, and the invoice that came out
// of them links back here.
router.delete('/:id', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  // The back-reference lives on Invoice (Invoice.estimateId is the unique FK),
  // so the guard has to load the relation — there is no invoiceId column here.
  const estimate = await prisma.estimate.findUnique({
    where: { id: req.params.id },
    include: { invoice: { select: { id: true } } }
  });
  if (!estimate || estimate.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Estimate not found' });
  }
  if (estimate.invoice) {
    return res.status(400).json({ error: 'This estimate was converted to an invoice and cannot be deleted' });
  }
  // Cascading a small clean-up here keeps the notification feed from keeping
  // dead links when a user deletes an estimate they never sent.
  await prisma.notification.deleteMany({ where: { estimateId: estimate.id } });
  await prisma.estimate.delete({ where: { id: estimate.id } });
  res.json({ ok: true });
});

module.exports = router;
