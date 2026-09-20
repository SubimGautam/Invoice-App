const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');

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

// Small money helpers shared with the invoice routes. Kept local so the
// payments module stays self-contained.
function invoiceTotal(invoice, taxRate) {
  const subtotal = invoice.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0);
  return subtotal * (1 + (Number(taxRate) || 0) / 100);
}

function paidSum(payments) {
  return (payments || []).reduce((s, p) => s + Number(p.amount), 0);
}

const MONEY_EPSILON = 0.001;

// POST /api/payments — record a (possibly partial) payment against an invoice.
// The invoice status is derived here automatically: once recorded payments
// cover the total it flips to paid, otherwise it becomes partially_paid.
router.post('/', async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { invoiceId, amount, method, paymentDate, reference, notes } = parsed.data;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, payments: true }
  });

  if (!invoice || invoice.userId !== req.userId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }
  if (invoice.status === 'draft') {
    return res.status(400).json({ error: 'Draft invoices cannot accept payments — send the invoice first.' });
  }
  if (invoice.status === 'paid') {
    return res.status(400).json({ error: 'This invoice is already paid' });
  }

  const settings = await prisma.userSettings.upsert({ where: { userId: req.userId }, update: {}, create: { userId: req.userId } });
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
        invoiceId,
        amount,
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

  res.status(201).json({
    payment,
    invoice: {
      ...updatedInvoice,
      total,
      paid: newPaid
    }
  });
});

module.exports = router;