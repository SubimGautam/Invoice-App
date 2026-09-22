const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { notifyWorkspace } = require('../lib/notify');
const { invoiceTotal, paidSum, MONEY_EPSILON } = require('../lib/money');

const router = express.Router();
router.use(requireAuth);

const paymentSchema = z.object({
  invoiceId: z.string().uuid('A valid invoice is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  method: z.string().min(1, 'Payment method is required'),
  paymentDate: z.string().datetime().or(z.string().min(1)).optional(),
  reference: z.string().optional(),
  notes: z.string().optional()
});

const unallocatedSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  method: z.string().min(1, 'Payment method is required'),
  paymentDate: z.string().datetime().or(z.string().min(1)).optional(),
  reference: z.string().optional(),
  notes: z.string().optional()
});

// Recompute an invoice's status from its recorded payments (refunds included —
// a refund lowers the paid total and can return an invoice to partially_paid).
async function recalcInvoice(invoiceId) {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, payments: true }
  });
  if (!inv) return null;
  const settings = await prisma.workspaceSettings.findUnique({ where: { workspaceId: inv.workspaceId } });
  const total = invoiceTotal(inv, Number(settings?.defaultTaxRate || 0));
  const paid = Math.round(paidSum(inv.payments) * 100) / 100;
  const fullyPaid = paid >= total - MONEY_EPSILON;
  const status = fullyPaid ? 'paid' : paid > 0 ? 'partially_paid' : 'pending';
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status, paidAt: fullyPaid ? (inv.paidAt || new Date()) : null }
  });
}

// GET /api/payments — everything that has come in or gone out, plus KPI cards.
// `months` filters the period (0 = all time). Rows unify recorded payments
// (settled/refund) with in-flight eSewa bookings (processing) so one table
// answers "what money have I actually received?" + "what's still in flight?"
router.get('/', async (req, res) => {
  const months = Math.max(0, Number(req.query.months) || 0);
  const from = months > 0 ? new Date(Date.now() - months * 30 * 86400000) : null;
  const dateFilter = from ? { paymentDate: { gte: from } } : {};
  const ws = req.workspaceId;
  const wsFilter = { workspaceId: ws };

  const [payments, attempts] = await Promise.all([
    prisma.payment.findMany({
      where: { ...wsFilter, ...dateFilter },
      include: { invoice: { select: { id: true, invoiceNumber: true, status: true, client: { select: { name: true } } } } },
      orderBy: { paymentDate: 'desc' },
      take: 1000
    }),
    prisma.paymentAttempt.findMany({
      where: { ...wsFilter, status: 'pending' },
      include: { invoice: { select: { id: true, invoiceNumber: true, client: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  // Refund totals per original payment (to know what's still refundable).
  const refundGroups = await prisma.payment.groupBy({
    by: ['refundOfId'],
    where: { ...wsFilter, kind: 'refund', refundOfId: { not: null } },
    _sum: { amount: true }
  });
  const refundedBy = {};
  for (const g of refundGroups) refundedBy[g.refundOfId] = Math.abs(Number(g._sum.amount || 0));

  const rows = [
    ...payments.map((p) => {
      const isRefund = p.kind === 'refund';
      const amount = Number(p.amount);
      const alreadyRefunded = refundedBy[p.id] || 0;
      return {
        id: p.id,
        type: isRefund ? 'refund' : 'payment',
        date: p.paymentDate,
        amount,
        method: p.method,
        reference: p.reference,
        notes: p.notes,
        customer: p.invoice?.client?.name || null,
        invoiceNumber: p.invoice?.invoiceNumber || null,
        invoiceId: p.invoiceId || null,
        status: isRefund ? 'Refunded' : 'Settled',
        allocatable: !p.invoiceId && !isRefund,
        refundable: !isRefund && p.invoiceId ? Math.round((amount - alreadyRefunded) * 100) / 100 : 0,
        refundOfId: p.refundOfId || null
      };
    }),
    ...attempts.map((a) => ({
      id: a.id,
      type: 'processing',
      date: a.createdAt,
      amount: Number(a.amount),
      method: 'eSewa',
      reference: (a.transactionUuid || '').slice(0, 8),
      notes: a.bookingId ? `Booking ${String(a.bookingId).slice(0, 12)}…` : null,
      customer: a.invoice?.client?.name || null,
      invoiceNumber: a.invoice?.invoiceNumber || null,
      invoiceId: a.invoiceId || null,
      status: 'Processing',
      allocatable: false,
      refundable: 0,
      refundOfId: null
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // ---- KPIs ------------------------------------------------------------
  const collectedFilter = { ...wsFilter, kind: 'payment', status: 'settled', invoiceId: { not: null } };
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [collectedAgg, unallocAgg, refundAgg, thisMonthAgg, processingCount] = await Promise.all([
    prisma.payment.aggregate({ where: { ...collectedFilter, ...dateFilter }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...wsFilter, kind: 'payment', status: 'settled', invoiceId: null }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...wsFilter, kind: 'refund', ...dateFilter }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({ where: { ...collectedFilter, paymentDate: { gte: startOfMonth } }, _count: { _all: true }, _sum: { amount: true } }),
    prisma.paymentAttempt.count({ where: { ...wsFilter, status: 'pending' } })
  ]);

  const kpis = {
    collected: Math.round(Number(collectedAgg._sum.amount || 0) * 100) / 100,
    receivedCount: payments.length,
    receivedAmount: 0,
    thisMonthCount: thisMonthAgg._count._all,
    thisMonthAmount: Math.round(Number(thisMonthAgg._sum.amount || 0) * 100) / 100,
    unallocated: Math.round(Number(unallocAgg._sum.amount || 0) * 100) / 100,
    refunds: Math.round(Math.abs(Number(refundAgg._sum.amount || 0)) * 100) / 100,
    refundCount: refundAgg._count,
    processing: processingCount
  };

  res.json({
    currency: (await prisma.workspaceSettings.findUnique({ where: { workspaceId: ws } }))?.currency || 'NPR',
    period: { months, from: from ? from.toISOString() : null },
    kpis,
    rows
  });
});

// POST /api/payments — record a (possibly partial) payment against an invoice.
// The invoice status is derived here automatically: once recorded payments
// cover the total it flips to paid, otherwise it becomes partially_paid.
router.post('/', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { invoiceId, amount, method, paymentDate, reference, notes } = parsed.data;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, payments: true }
  });

  if (!invoice || invoice.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  if (invoice.status === 'draft') {
    return res.status(400).json({ error: 'Draft invoices cannot accept payments — send the invoice first.' });
  }
  if (invoice.status === 'paid') {
    return res.status(400).json({ error: 'This invoice is already paid' });
  }

  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });
  const total = invoiceTotal(invoice, Number(settings.defaultTaxRate || 0));
  const paid = paidSum(invoice.payments);
  const remaining = Math.max(0, total - paid);

  if (amount > remaining + MONEY_EPSILON) {
    return res.status(400).json({ error: `This payment exceeds the remaining balance of ${remaining.toFixed(2)}` });
  }

  const newPaid = paid + amount;
  const fullyPaid = newPaid >= total - MONEY_EPSILON;

  // Create the payment + update the invoice status in one transaction so a
  // failure can never leave them out of sync.
  const [payment, updatedInvoice] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        workspaceId: req.workspaceId,
        invoiceId,
        amount,
        kind: 'payment',
        status: 'settled',
        method,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        reference: reference || null,
        notes: notes || null
      }
    }),
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: fullyPaid ? 'paid' : 'partially_paid',
        paidAt: fullyPaid ? new Date() : undefined,
        auditLogs: {
          create: {
            type: 'payment',
            message: fullyPaid
              ? `Payment of ${amount} recorded — invoice fully paid`
              : `Payment of ${amount} received via ${method} — partially paid`
          }
        }
      },
      include: { client: true, items: true, payments: true, auditLogs: { orderBy: { createdAt: 'desc' } } }
    })
  ]);

  await notifyWorkspace({
    workspaceId: req.workspaceId,
    excludeUserId: req.userId,
    type: fullyPaid ? 'invoice_paid' : 'payment',
    title: fullyPaid ? 'Invoice paid' : 'Payment received',
    message: fullyPaid
      ? `${updatedInvoice.invoiceNumber} fully paid (${amount})`
      : `Payment of ${amount} received on ${updatedInvoice.invoiceNumber}`,
    invoiceId: updatedInvoice.id
  });

  res.status(201).json({
    payment,
    invoice: {
      ...updatedInvoice,
      total,
      paid: newPaid
    }
  });
});

// POST /api/payments/unallocated — money received that isn't tied to an
// invoice yet (a client's transfer without the invoice number, for example).
// It shows in the Unallocated KPI until someone allocates it.
router.post('/unallocated', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = unallocatedSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { amount, method, paymentDate, reference, notes } = parsed.data;
  const payment = await prisma.payment.create({
    data: {
      workspaceId: req.workspaceId,
      invoiceId: null,
      amount,
      kind: 'payment',
      status: 'settled',
      method,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      reference: reference || null,
      notes: notes || (reference ? null : 'Unallocated receipt')
    }
  });
  await notifyWorkspace({
    workspaceId: req.workspaceId,
    excludeUserId: req.userId,
    type: 'payment',
    title: 'Unallocated payment',
    message: `Received ${amount} (${method}) — not yet linked to an invoice`
  });
  res.status(201).json(payment);
});

// POST /api/payments/:id/allocate — attach an unallocated receipt to an invoice.
router.post('/:id/allocate', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = z.object({ invoiceId: z.string().uuid('A valid invoice is required') }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment || payment.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  if (payment.invoiceId) {
    return res.status(400).json({ error: 'This payment is already linked to an invoice.' });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: parsed.data.invoiceId } });
  if (!invoice || invoice.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  if (invoice.status === 'draft') {
    return res.status(400).json({ error: 'Draft invoices cannot receive payments — send the invoice first.' });
  }

  await prisma.payment.update({ where: { id: payment.id }, data: { invoiceId: invoice.id } });
  const updated = await recalcInvoice(invoice.id);
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { auditLogs: { create: { type: 'payment', message: `Unallocated payment of ${payment.amount} applied to ${invoice.invoiceNumber}` } } }
  }).catch(() => {});
  await notifyWorkspace({
    workspaceId: req.workspaceId,
    excludeUserId: req.userId,
    type: 'payment',
    title: 'Payment allocated',
    message: `Payment of ${payment.amount} linked to ${invoice.invoiceNumber}`,
    invoiceId: invoice.id
  });

  res.json({ ok: true, payment: { ...payment, invoiceId: invoice.id }, invoice: updated });
});

// POST /api/payments/:id/refund — reverse part (or all) of a settled payment.
// Creates a refund record (negative amount, kind 'refund') pointing at the
// original payment and recalculates the invoice's status/balance.
router.post('/:id/refund', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = z.object({
    amount: z.number().positive('Refund amount must be greater than 0'),
    reason: z.string().optional()
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment || payment.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  if (payment.kind !== 'payment') {
    return res.status(400).json({ error: 'Only a recorded payment can be refunded.' });
  }

  const refundedAgg = await prisma.payment.aggregate({
    where: { workspaceId: req.workspaceId, kind: 'refund', refundOfId: payment.id },
    _sum: { amount: true }
  });
  const alreadyRefunded = Math.abs(Number(refundedAgg._sum.amount || 0));
  const refundable = Math.round((Number(payment.amount) - alreadyRefunded) * 100) / 100;
  if (parsed.data.amount > refundable + MONEY_EPSILON) {
    return res.status(400).json({ error: `Only ${refundable.toFixed(2)} of this payment is still refundable.` });
  }

  const invoice = payment.invoiceId ? await prisma.invoice.findUnique({ where: { id: payment.invoiceId } }) : null;
  const refund = await prisma.payment.create({
    data: {
      workspaceId: req.workspaceId,
      invoiceId: payment.invoiceId,
      amount: -parsed.data.amount,
      kind: 'refund',
      status: 'settled',
      method: 'Refund',
      paymentDate: new Date(),
      reference: `REF-${payment.id.slice(0, 8).toUpperCase()}`,
      notes: parsed.data.reason || `Refund of ${parsed.data.amount} against payment ${payment.id.slice(0, 8)}`,
      refundOfId: payment.id
    }
  });

  let updatedInvoice = null;
  if (invoice) {
    updatedInvoice = await recalcInvoice(invoice.id);
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { auditLogs: { create: { type: 'refund', message: `Refund of ${parsed.data.amount} issued (${parsed.data.reason || 'no reason given'})` } } }
    }).catch(() => {});
  }
  await notifyWorkspace({
    workspaceId: req.workspaceId,
    excludeUserId: req.userId,
    type: 'refund',
    title: 'Refund issued',
    message: invoice
      ? `Refund of ${parsed.data.amount} on ${invoice.invoiceNumber}`
      : `Refund of ${parsed.data.amount} issued`,
    invoiceId: invoice?.id || null
  });

  res.status(201).json({ ok: true, refund, invoice: updatedInvoice });
});

module.exports = router;