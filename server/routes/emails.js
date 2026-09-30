const express = require('express');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { sendEmail } = require('../lib/mailer');
const { invoiceEmail, reminderEmail, estimateEmail } = require('../lib/emailTemplates');
const { generatePaymentToken } = require('../lib/paymenttoken');
const { invoiceTotal, paidSum } = require('../lib/money');
const { notifyWorkspace } = require('../lib/notify');

const router = express.Router();
router.use(requireAuth);

// Loads the invoice (workspace-scoped) + the shared business identity used in
// the email header. Returns null with a response already sent on failure.
async function loadContext(req, res) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { client: true, items: true, payments: true }
  });
  if (!invoice || invoice.workspaceId !== req.workspaceId) {
    res.status(404).json({ error: 'Invoice not found' });
    return null;
  }
  if (!invoice.client.email) {
    res.status(400).json({ error: `Client ${invoice.client.name} has no email address — add one to send invoices` });
    return null;
  }
  const [settings, profile] = await Promise.all([
    prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } }),
    prisma.businessProfile.findUnique({ where: { workspaceId: req.workspaceId } })
  ]);
  return {
    invoice,
    businessName: profile?.businessName || 'Billflow',
    currency: settings.currency,
    // Public payment link token — suppressed on already-paid invoices.
    paymentToken: invoice.status === 'paid' ? null : invoice.paymentToken,
    total: invoiceTotal(invoice, Number(settings.defaultTaxRate || 0))
  };
}

// GET /api/emails/log?invoiceId=&estimateId= — delivery history for the
// workspace (filtered to one document when requested).
router.get('/log', async (req, res) => {
  const where = { workspaceId: req.workspaceId };
  if (req.query.invoiceId) where.invoiceId = req.query.invoiceId;
  if (req.query.estimateId) where.estimateId = req.query.estimateId;
  const logs = await prisma.emailLog.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    take: Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200)
  });
  res.json(logs);
});

// POST /api/emails/invoice/:id/send — email the invoice to the client.
// Marks the invoice as sent (sentAt + audit log) and notifies the team.
router.post('/invoice/:id/send', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const ctx = await loadContext(req, res);
  if (!ctx) return;

  const { invoice, businessName, total, currency, paymentToken } = ctx;
  const { subject, html } = invoiceEmail({
    businessName,
    clientName: invoice.client.name,
    invoiceNumber: invoice.invoiceNumber,
    total,
    dueDate: invoice.dueDate,
    invoiceId: invoice.id,
    note: invoice.notes || '',
    currency,
    paymentToken
  });

  const result = await sendEmail({
    workspaceId: req.workspaceId,
    userId: req.userId,
    invoiceId: invoice.id,
    type: 'invoice',
    to: invoice.client.email,
    subject,
    html
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      sentAt: new Date(),
      auditLogs: { create: { type: 'sent', message: `Invoice emailed to ${invoice.client.email}${result.simulated ? ' (simulated — SMTP not configured)' : ''}` } }
    }
  });

  await notifyWorkspace({
    workspaceId: req.workspaceId,
    excludeUserId: req.userId,
    type: 'invoice_sent',
    title: 'Invoice sent',
    message: `${invoice.invoiceNumber} emailed to ${invoice.client.name}`,
    invoiceId: invoice.id
  });

  res.json({
    ok: result.ok,
    simulated: result.simulated,
    message: result.simulated
      ? 'Email simulated (SMTP not configured). See server console + email log.'
      : `${invoice.invoiceNumber} sent to ${invoice.client.email}`
  });
});

// POST /api/emails/invoice/:id/reminder — send a reminder for an open invoice.
router.post('/invoice/:id/reminder', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const ctx = await loadContext(req, res);
  if (!ctx) return;

  const { invoice, businessName, total, currency, paymentToken } = ctx;
  const overdue = new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid';
  const { subject, html } = reminderEmail({
    businessName,
    clientName: invoice.client.name,
    invoiceNumber: invoice.invoiceNumber,
    total,
    dueDate: invoice.dueDate,
    invoiceId: invoice.id,
    overdue,
    currency,
    paymentToken
  });

  const result = await sendEmail({
    workspaceId: req.workspaceId,
    userId: req.userId,
    invoiceId: invoice.id,
    type: 'reminder',
    to: invoice.client.email,
    subject,
    html
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      auditLogs: { create: { type: 'reminder', message: `Reminder emailed to ${invoice.client.email}${result.simulated ? ' (simulated — SMTP not configured)' : ''}` } }
    }
  });

  await notifyWorkspace({
    workspaceId: req.workspaceId,
    excludeUserId: req.userId,
    type: 'reminder_sent',
    title: 'Reminder sent',
    message: `${overdue ? 'Overdue reminder' : 'Reminder'} for ${invoice.invoiceNumber} sent to ${invoice.client.name}`,
    invoiceId: invoice.id
  });

  res.json({
    ok: result.ok,
    simulated: result.simulated,
    message: result.simulated
      ? 'Email simulated (SMTP not configured). See server console + email log.'
      : `Reminder sent to ${invoice.client.email}`
  });
});

// POST /api/emails/reminders/batch — reminders for every open invoice with an
// email address (the Dashboard "Batch Reminders" action).
router.post('/reminders/batch', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const [settings, profile] = await Promise.all([
    prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } }),
    prisma.businessProfile.findUnique({ where: { workspaceId: req.workspaceId } })
  ]);
  const taxRate = Number(settings.defaultTaxRate || 0);

  const invoices = await prisma.invoice.findMany({
    where: {
      workspaceId: req.workspaceId,
      status: { in: ['pending', 'partially_paid'] },
      client: { email: { not: null } }
    },
    include: { client: true, items: true, payments: true }
  });

  const businessName = profile?.businessName || 'Billflow';
  let sent = 0;
  let anySimulated = false;
  for (const invoice of invoices) {
    const overdue = new Date(invoice.dueDate) < new Date();
    const { subject, html } = reminderEmail({
      businessName,
      clientName: invoice.client.name,
      invoiceNumber: invoice.invoiceNumber,
      total: invoiceTotal(invoice, taxRate),
      dueDate: invoice.dueDate,
      invoiceId: invoice.id,
      overdue,
      currency: settings.currency,
      paymentToken: invoice.paymentToken
    });
    const result = await sendEmail({
      workspaceId: req.workspaceId,
      userId: req.userId,
      invoiceId: invoice.id,
      type: 'batch',
      to: invoice.client.email,
      subject,
      html
    });
    if (result.simulated) anySimulated = true;
    sent += 1;
  }

  if (sent > 0) {
    await notifyWorkspace({
      workspaceId: req.workspaceId,
      excludeUserId: req.userId,
      type: 'reminders_batch',
      title: 'Batch reminders sent',
      message: `Reminders emailed for ${sent} open invoice${sent === 1 ? '' : 's'}`
    });
  }

  res.json({ sent, skipped: invoices.length - sent, simulated: anySimulated });
});

// POST /api/emails/estimate/:id/send — email the quote to the client.
// Moves a draft to 'sent' (this is the moment the client is actually given the
// quote) and stamps sentAt. Sending an already-sent/answered quote just
// re-delivers it, which is a normal "did you get my last one?" action.
router.post('/estimate/:id/send', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const estimate = await prisma.estimate.findUnique({
    where: { id: req.params.id },
    include: { client: true, items: true }
  });
  if (!estimate || estimate.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Estimate not found' });
  }
  if (estimate.status === 'converted') {
    return res.status(400).json({ error: 'This estimate was converted to an invoice and cannot be re-sent' });
  }
  if (!estimate.client.email) {
    return res.status(400).json({ error: `Client ${estimate.client.name} has no email address — add one to send estimates` });
  }

  const [settings, profile] = await Promise.all([
    prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } }),
    prisma.businessProfile.findUnique({ where: { workspaceId: req.workspaceId } })
  ]);

  // Ensure a link exists even for estimates created before the token column.
  let viewToken = estimate.viewToken;
  if (!viewToken) {
    viewToken = generatePaymentToken();
    await prisma.estimate.update({ where: { id: estimate.id }, data: { viewToken } });
  }

  const { subject, html } = estimateEmail({
    businessName: profile?.businessName || 'Billflow',
    clientName: estimate.client.name,
    estimateNumber: estimate.estimateNumber,
    total: invoiceTotal(estimate, Number(settings.defaultTaxRate || 0)),
    validUntil: estimate.validUntil,
    estimateId: estimate.id,
    viewToken,
    note: estimate.notes || '',
    currency: settings.currency
  });

  const result = await sendEmail({
    workspaceId: req.workspaceId,
    userId: req.userId,
    estimateId: estimate.id,
    type: 'estimate',
    to: estimate.client.email,
    subject,
    html
  });

  await prisma.estimate.update({
    where: { id: estimate.id },
    data: {
      // A draft becomes 'sent' on first delivery. An answered quote keeps its
      // answer — re-sending must not wipe the client's response.
      status: estimate.status === 'draft' ? 'sent' : estimate.status,
      sentAt: estimate.sentAt || new Date(),
      auditLogs: { create: { type: 'sent', message: `Estimate emailed to ${estimate.client.email}${result.simulated ? ' (simulated — SMTP not configured)' : ''}` } }
    }
  });

  await notifyWorkspace({
    workspaceId: req.workspaceId,
    excludeUserId: req.userId,
    // Its own type, not 'invoice_sent' — reusing that would file quotes under
    // the invoice feed and misrepresent them as billing events.
    type: 'estimate_sent',
    title: 'Estimate sent',
    message: `${estimate.estimateNumber} emailed to ${estimate.client.name}`,
    estimateId: estimate.id
  });

  res.json({
    ok: result.ok,
    simulated: result.simulated,
    message: result.simulated
      ? 'Email simulated (SMTP not configured). See server console + email log.'
      : `${estimate.estimateNumber} sent to ${estimate.client.email}`
  });
});

module.exports = router;