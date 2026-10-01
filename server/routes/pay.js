const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const prisma = require('../prisma');
const { notifyWorkspace } = require('../lib/notify');
const { sendEmail } = require('../lib/mailer');
const { invoiceTotal, paidSum, lineAmount, moneyNumber, MONEY_EPSILON } = require('../lib/money');
const { paymentReceiptEmail } = require('../lib/emailTemplates');
const esewa = require('../lib/esewa');

const router = express.Router();

// Public payment endpoint — INTENTIONALLY not behind requireAuth. A client
// pays without an account, authenticated only by the unguessable token in the
// "Pay now" button of the invoice email.
//
// Two paths:
//   1. Gateway (eSewa): POST /:token/initiate books a payment, the client is
//      redirected to eSewa, then POST /:token/resolve (or the /callback
//      webhook) verifies the status and records the payment. PaymentAttempt is
//      the ledger so nothing double-records.
//   2. Simulated: POST /:token with card fields (demo fallback, no gateway).

const TOKEN_RE = /^[0-9a-f]{32,64}$/;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
// For the eSewa webhook. In dev this stays localhost (eSewa can't reach it);
// the redirect-resolve path is the primary confirmation. In production set a
// public SERVER_URL so callbacks also land.
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

function cardBrand(number) {
  const n = String(number || '').replace(/\s+/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'American Express';
  return 'Card';
}

function luhnValid(number) {
  const digits = String(number).replace(/\s+/g, '').split('').map(Number);
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

async function loadByToken(token) {
  if (!TOKEN_RE.test(token)) return null;
  const invoice = await prisma.invoice.findUnique({
    where: { paymentToken: token },
    include: {
      client: true,
      items: true,
      payments: true,
      workspace: { include: { settings: true, businessProfile: true } }
    }
  });
  // Defence in depth: voiding nulls the token, so a voided invoice normally
  // can't be found here at all. But a client may hold an already-emailed link
  // from before the void, and money must never be taken for a cancelled
  // invoice. Treating void as "not found" gives the same 404 as a bad token.
  if (!invoice || invoice.status === 'void') return null;
  return invoice;
}

function toSummary(invoice) {
  const settings = invoice.workspace.settings;
  const taxRate = Number(settings?.defaultTaxRate || 0);
  const total = invoiceTotal(invoice, taxRate);
  const paid = paidSum(invoice.payments);
  const remaining = Math.round(Math.max(0, total - paid) * 100) / 100;
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    currency: settings?.currency || 'NPR',
    businessName: invoice.workspace.businessProfile?.businessName || invoice.workspace.name,
    clientName: invoice.client.name,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    notes: invoice.notes,
    discount: Number(invoice.discount || 0),
    items: invoice.items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      amount: lineAmount(it)
    })),
    // money.js already returns cent-rounded numbers; the old
    // `Math.round(x * 100) / 100` here was redundant float rounding that is
    // itself a 1.005 -> 1.00 trap.
    total,
    paid,
    remaining,
    paidAt: invoice.paidAt
  };
}

function remainingOf(invoice) {
  const settings = invoice.workspace.settings;
  const taxRate = Number(settings?.defaultTaxRate || 0);
  const total = invoiceTotal(invoice, taxRate);
  const paid = paidSum(invoice.payments);
  return { total, paid, remaining: Math.max(0, total - paid) };
}

// Record a payment and flip the invoice — shared by every path (gateway,
// simulated). Idempotent: if a payment with the same `reference` already
// exists, this does nothing (gateway callback + redirect-resolve can both fire).
//
// Concurrency: the check-then-create is wrapped in a single interactive
// transaction that locks the invoice row. If two request handlers fire at once
// (a real race: the eSewa webhook and the redirect-resolve both land), the
// second caller blocks on the row lock, then re-runs the reference check after
// the first has committed and sees the already-recorded payment. The `paid`
// sum is also recomputed under the lock so a stale snapshot can't double-count.
async function recordPayment({ invoice, amount, method, reference, notes, attempt }) {
  const settings = invoice.workspace.settings;
  const taxRate = Number(settings?.defaultTaxRate || 0);
  const total = invoiceTotal(invoice, taxRate);

  const outcome = await prisma.$transaction(async (tx) => {
    // Serialize concurrent recordings for this invoice. FOR UPDATE means the
    // second transaction waits here until the first commits.
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoice.id} FOR UPDATE`;

    const existing = await tx.payment.findFirst({ where: { reference } });
    if (existing) {
      const paid = paidSum(await tx.payment.findMany({ where: { invoiceId: invoice.id }, select: { amount: true } }));
      const remainingAfter = Math.round(Math.max(0, total - paid) * 100) / 100;
      return { duplicate: true, paid, remaining: remainingAfter, fullyPaid: paid >= total - MONEY_EPSILON };
    }

    // Recompute under the lock — the caller's `invoice.payments` snapshot may
    // predate a payment the current transaction is racing with.
    const paid = paidSum(await tx.payment.findMany({ where: { invoiceId: invoice.id }, select: { amount: true } }));
    const newPaid = Math.round((paid + amount) * 100) / 100;
    const fullyPaid = newPaid >= total - MONEY_EPSILON;
    const remainingAfter = Math.round(Math.max(0, total - newPaid) * 100) / 100;

    await tx.payment.create({
      data: {
        workspaceId: invoice.workspaceId,
        invoiceId: invoice.id,
        amount,
        kind: 'payment',
        status: 'settled',
        method,
        reference,
        notes
      }
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: fullyPaid ? 'paid' : 'partially_paid',
        paidAt: fullyPaid ? new Date() : undefined,
        auditLogs: {
          create: {
            type: 'payment',
            message: fullyPaid
              ? `Payment of ${amount} received (${method}) — invoice fully paid`
              : `Payment of ${amount} received via ${method} — partially paid`
          }
        }
      }
    });

    return { duplicate: false, paid: newPaid, remaining: remainingAfter, fullyPaid };
  });

  if (outcome.duplicate) {
    return { duplicate: true, total, paid: outcome.paid, remaining: outcome.remaining, fullyPaid: outcome.fullyPaid };
  }

  const { remaining: remainingAfter, fullyPaid } = outcome;

  if (attempt) {
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: fullyPaid ? 'paid' : 'partial', referenceCode: attempt.referenceCode, gatewayTxnId: attempt.gatewayTxnId }
    }).catch(() => {});
  }

  await notifyWorkspace({
    workspaceId: invoice.workspaceId,
    excludeUserId: invoice.userId,
    type: fullyPaid ? 'invoice_paid' : 'payment',
    title: fullyPaid ? 'Invoice paid' : 'Payment received',
    message: fullyPaid
      ? `${invoice.invoiceNumber} paid in full via ${method} (${amount})`
      : `Payment of ${amount} received on ${invoice.invoiceNumber} (${method})`,
    invoiceId: invoice.id
  });

  // Receipt email to the client (simulated when SMTP isn't configured).
  if (invoice.client.email) {
    try {
      const receipt = paymentReceiptEmail({
        businessName: invoice.workspace.businessProfile?.businessName || invoice.workspace.name,
        clientName: invoice.client.name,
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: amount,
        remaining: remainingAfter,
        currency: settings?.currency || 'NPR',
        invoiceId: invoice.id
      });
      await sendEmail({
        workspaceId: invoice.workspaceId,
        userId: invoice.userId,
        invoiceId: invoice.id,
        type: 'payment_receipt',
        to: invoice.client.email,
        subject: receipt.subject,
        html: receipt.html
      });
    } catch (err) {
      console.error('[pay] receipt email failed:', err.message);
    }
  }

  return { duplicate: outcome.duplicate, total, paid: outcome.paid, remaining: outcome.remaining, fullyPaid: outcome.fullyPaid };
}

// GET /api/pay/:token — public invoice summary for the payment page.
router.get('/:token', async (req, res) => {
  const invoice = await loadByToken(req.params.token);
  // One identical message for unknown/invalid/draft links so the token can't be probed.
  if (!invoice || invoice.status === 'draft') {
    return res.status(404).json({ error: 'This payment link is not valid or the invoice no longer exists.' });
  }

  // Read-receipt beacon: the client opening their pay link IS the "viewed" event.
  // Only stamped once the invoice has actually been sent (sentAt) so a preview on
  // a draft doesn't count. Best-effort — a tracking hiccup must never break checkout.
  if (invoice.sentAt) {
    const now = new Date();
    prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        firstViewedAt: invoice.firstViewedAt || now,
        lastViewedAt: now,
        viewCount: { increment: 1 }
      }
    }).catch((err) => console.error('[pay] view tracking failed:', err.message));
  }

  const data = toSummary(invoice);
  res.json({ ...data, alreadyPaid: data.status === 'paid' || data.remaining <= MONEY_EPSILON });
});

// POST /api/pay/callback — eSewa webhook with the final payment status.
// Registered BEFORE /:token (single-segment collision).
router.post('/callback', async (req, res) => {
  try {
    const body = req.body || {};
    const check = esewa.verifyCallbackSignature(body);
    if (!check.ok) {
      return res.status(400).json({ code: 'IP-400', error_message: 'Invalid signature' });
    }
    if (body.status === 'SUCCESS') {
      const attempt = await prisma.paymentAttempt.findFirst({
        where: { correlationId: body.correlation_id },
        orderBy: { createdAt: 'desc' }
      }).catch(() => null);
      if (!attempt) return res.status(200).json({ received: true });
      const inv = await prisma.invoice.findUnique({
        where: { id: attempt.invoiceId },
        include: { client: true, items: true, payments: true, workspace: { include: { settings: true, businessProfile: true } } }
      });
      if (!inv) return res.status(200).json({ received: true });
      // Persist the gateway reference on the attempt so the ledger is complete.
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { referenceCode: body.reference_code || null }
      }).catch(() => {});
      await recordPayment({
        invoice: inv,
        amount: attempt.amount,
        method: 'eSewa',
        reference: attempt.transactionUuid,
        notes: 'Paid via eSewa (callback)',
        attempt: { ...attempt, referenceCode: body.reference_code || null }
      });
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[pay] callback error:', err.message);
    res.status(200).json({ received: true });
  }
});

// POST /api/pay/:token/initiate — start a gateway checkout (eSewa). Returns the
// payment URL to redirect the client to, plus the attempt id for reconciliation.
router.post('/:token/initiate', async (req, res) => {
  const parsed = z.object({
    amount: z.number().positive('Enter an amount to pay'),
    gateway: z.string().default('esewa')
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const invoice = await loadByToken(req.params.token);
  if (!invoice || invoice.status === 'draft') {
    return res.status(404).json({ error: 'This payment link is not valid or the invoice no longer exists.' });
  }

  const { total, remaining } = remainingOf(invoice);
  if (remaining <= MONEY_EPSILON) {
    return res.status(400).json({ error: 'This invoice is already fully paid.' });
  }
  // Normalise the requested amount through Decimal half-up rounding. A gateway
  // callback or a typed value like 1.005 must not become 1.00: the recorded
  // payment has to equal what was actually charged, or the invoice stops
  // reconciling against the gateway statement.
  const amount = moneyNumber(parsed.data.amount);
  if (amount > remaining + MONEY_EPSILON) {
    return res.status(400).json({ error: `This is more than the remaining balance of ${remaining.toFixed(2)}.` });
  }
  if (amount < 1) {
    return res.status(400).json({ error: 'Amount must be at least Rs 1.' });
  }

  const transactionUuid = crypto.randomUUID();
  const attempt = await prisma.paymentAttempt.create({
    data: {
      workspaceId: invoice.workspaceId,
      invoiceId: invoice.id,
      amount,
      currency: invoice.workspace.settings?.currency || 'NPR',
      gateway: parsed.data.gateway,
      transactionUuid,
      status: 'created'
    }
  });

  let book;
  try {
    book = await esewa.initiate({
      amount,
      transactionUuid,
      callbackUrl: `${SERVER_URL}/api/pay/callback`,
      redirectUrl: `${CLIENT_URL}/pay/${req.params.token}?attempt=${attempt.id}`,
      customerId: invoice.client.id,
      remarks: `Invoice ${invoice.invoiceNumber} payment`
    });
  } catch (err) {
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: 'failed', error: err.message }
    }).catch(() => {});
    return res.status(502).json({ error: err.message });
  }

  await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: { bookingId: book.bookingId, correlationId: book.correlationId, status: 'pending' }
  });

  res.json({
    ok: true,
    attempt: attempt.id,
    bookingId: book.bookingId,
    correlationId: book.correlationId,
    paymentUrl: book.deeplink
  });
});

// POST /api/pay/:token/resolve — final confirmation after the client returns
// from eSewa. Verifies the booking status server-side; only SUCCESS records.
router.post('/:token/resolve', async (req, res) => {
  const parsed = z.object({
    attemptId: z.string().min(1)
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: parsed.data.attemptId }
  });
  if (!attempt || !attempt.bookingId || !attempt.correlationId) {
    return res.status(404).json({ error: 'Payment attempt not found.' });
  }

  // Already recorded (e.g. the webhook landed first and this is a re-visit).
  // Don't clobber the ledger with the gateway's pre-verification status.
  if (attempt.status === 'paid' || attempt.status === 'partial') {
    const inv = await prisma.invoice.findUnique({
      where: { id: attempt.invoiceId },
      include: { items: true, payments: true, workspace: { include: { settings: true } } }
    });
    if (!inv) return res.status(404).json({ error: 'Invoice not found.' });
    const { total, paid, remaining } = remainingOf(inv);
    return res.status(200).json({
      ok: true,
      status: 'SUCCESS',
      alreadyRecorded: true,
      invoice: {
        invoiceNumber: inv.invoiceNumber,
        status: remaining <= MONEY_EPSILON ? 'paid' : 'partially_paid',
        amountPaid: attempt.amount,
        total,
        paid,
        remaining
      }
    });
  }

  let verdict;
  try {
    verdict = await esewa.verify({ bookingId: attempt.bookingId, correlationId: attempt.correlationId });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  await prisma.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      status: verdict.status,
      referenceCode: verdict.referenceCode,
      gatewayTxnId: verdict.gatewayTxnId
    }
  }).catch(() => {});

  if (verdict.status !== 'SUCCESS') {
    return res.status(200).json({
      ok: false,
      status: verdict.status,
      message: verdict.status === 'BOOKED' || verdict.status === 'PENDING'
        ? 'Payment is still being processed. Please complete it in the eSewa app, then try again.'
        : 'The payment was not completed (canceled or failed). You can try again below.'
    });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: attempt.invoiceId },
    include: { client: true, items: true, payments: true, workspace: { include: { settings: true, businessProfile: true } } }
  });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

  const result = await recordPayment({
    invoice,
    amount: attempt.amount,
    method: 'eSewa',
    reference: attempt.transactionUuid,
    notes: `Paid via eSewa (booking ${attempt.bookingId})`,
    attempt
  });

  const { total } = remainingOf(invoice);
  res.json({
    ok: true,
    status: 'SUCCESS',
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      status: result.fullyPaid ? 'paid' : 'partially_paid',
      amountPaid: attempt.amount,
      total,
      paid: result.paid,
      remaining: result.remaining
    }
  });
});

// POST /api/pay/:token — SIMULATED checkout (demo fallback when no gateway is
// configured or the client prefers the offline demo). Still records for real.
router.post('/:token', async (req, res) => {
  const parsed = z.object({
    amount: z.number().positive('Enter an amount to pay'),
    holderName: z.string().min(2, 'Enter the cardholder name'),
    cardNumber: z.string().min(12, 'Enter a valid card number').max(19, 'Card number looks too long'),
    expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry must be in MM/YY format'),
    cvv: z.string().regex(/^\d{3,4}$/, 'CVV is 3–4 digits')
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const invoice = await loadByToken(req.params.token);
  if (!invoice || invoice.status === 'draft') {
    return res.status(404).json({ error: 'This payment link is not valid or the invoice no longer exists.' });
  }

  const { total, remaining } = remainingOf(invoice);
  if (remaining <= MONEY_EPSILON) {
    return res.status(400).json({ error: 'This invoice is already fully paid.' });
  }

  const { amount, holderName, cardNumber, expiry, cvv } = parsed.data;

  // Simulated gateway validations — feel real, charge nothing.
  if (!luhnValid(cardNumber)) {
    return res.status(400).json({ error: 'That card number failed the checksum — double-check it.' });
  }
  const [mm, yy] = expiry.split('/');
  const expiryDate = new Date(2000 + Number(yy), Number(mm)); // month is 0-indexed → end of MM/YY
  if (expiryDate <= new Date()) {
    return res.status(400).json({ error: 'That card has expired — use a current expiry date.' });
  }
  if (amount > remaining + MONEY_EPSILON) {
    return res.status(400).json({ error: `This is more than the remaining balance of ${remaining.toFixed(2)}.` });
  }

  const method = `Online · ${cardBrand(cardNumber)}`;
  const reference = crypto.randomUUID();

  const attempt = await prisma.paymentAttempt.create({
    data: {
      workspaceId: invoice.workspaceId,
      invoiceId: invoice.id,
      amount,
      currency: invoice.workspace.settings?.currency || 'NPR',
      gateway: 'simulated',
      transactionUuid: reference,
      status: 'paid'
    }
  });

  const result = await recordPayment({
    invoice,
    amount,
    method,
    reference,
    notes: `Paid online by ${holderName} (simulated gateway)`,
    attempt
  });

  res.status(201).json({
    ok: true,
    payment: { amount, method },
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: result.fullyPaid ? 'paid' : 'partially_paid',
      amountPaid: amount,
      total,
      paid: result.paid,
      remaining: result.remaining
    }
  });
});

module.exports = router;