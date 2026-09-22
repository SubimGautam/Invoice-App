const express = require('express');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { sendEmail } = require('../lib/mailer');
const { invoiceEmail, reminderEmail } = require('../lib/emailTemplates');
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
    total: invoiceTotal(invoice, Number(settings.defaultTaxRate || 0))
  };
}

// GET /api/emails/log?invoiceId= — delivery history for the workspace (filtered
// to one invoice when requested).
router.get('/log', async (req, res) => {
  const where = { workspaceId: req.workspaceId };
  if (req.query.invoiceId) where.invoiceId = req.query.invoiceId;
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

  const { invoice, businessName, total } = ctx;
  const { subject, html } = invoiceEmail({
    businessName,
    clientName: invoice.client.name,
    invoiceNumber: invoice.invoiceNumber,
    total,
    dueDate: invoice.dueDate,
    invoiceId: invoice.id,
    note: invoice.notes || ''
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

  const { invoice, businessName, total } = ctx;
  const overdue = new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid';
  const { subject, html } = reminderEmail({
    businessName,
    clientName: invoice.client.name,
    invoiceNumber: invoice.invoiceNumber,
    total,
    dueDate: invoice.dueDate,
    invoiceId: invoice.id,
    overdue
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
  for (const invoice of invoices) {
    const overdue = new Date(invoice.dueDate) < new Date();
    const { subject, html } = reminderEmail({
      businessName,
      clientName: invoice.client.name,
      invoiceNumber: invoice.invoiceNumber,
      total: invoiceTotal(invoice, taxRate),
      dueDate: invoice.dueDate,
      invoiceId: invoice.id,
      overdue
    });
    await sendEmail({
      workspaceId: req.workspaceId,
      userId: req.userId,
      invoiceId: invoice.id,
      type: 'batch',
      to: invoice.client.email,
      subject,
      html
    });
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

  res.json({ sent, skipped: invoices.length - sent });
});

module.exports = router;