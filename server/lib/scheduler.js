const prisma = require('../prisma');
const generateInvoiceNumber = require('./invoicenumber');
const { notifyWorkspace } = require('./notify');

// In-process scheduler. Kept deliberately simple: a timer that periodically
// (a) materializes due recurring invoices and (b) flags newly-overdue invoices
// with notifications. Started from server.js. The same functions are exposed
// through routes too, so schedules can be generated on demand and tests can
// drive them synchronously.

function advanceDate(d, frequency) {
  const nd = new Date(d);
  switch (frequency) {
    case 'weekly': nd.setDate(nd.getDate() + 7); break;
    case 'monthly': nd.setMonth(nd.getMonth() + 1); break;
    case 'quarterly': nd.setMonth(nd.getMonth() + 3); break;
    case 'yearly': nd.setFullYear(nd.getFullYear() + 1); break;
  }
  return nd;
}

// Materialize any due recurring invoices. Optimistic locking via the
// nextRunDate in the updateMany guard keeps the in-process timer and a manual
// "generate now" from double-creating.
async function generateDueRecurring({ workspaceId = null } = {}) {
  const where = { active: true, nextRunDate: { lte: new Date() } };
  if (workspaceId) where.workspaceId = workspaceId;

  const schedules = await prisma.recurringInvoice.findMany({
    where,
    include: { items: true, client: true, workspace: true }
  });

  const settingsCache = new Map();
  let created = 0;

  for (const schedule of schedules) {
    try {
      let settings = settingsCache.get(schedule.workspaceId);
      if (!settings) {
        settings = await prisma.workspaceSettings.upsert({
          where: { workspaceId: schedule.workspaceId },
          update: {},
          create: { workspaceId: schedule.workspaceId }
        });
        settingsCache.set(schedule.workspaceId, settings);
      }

      const issueDate = new Date();
      issueDate.setHours(0, 0, 0, 0);
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + Number(settings.defaultPaymentTerms || 30));

      // Retry handles the rare invoice-number collision under concurrency.
      let invoice = null;
      for (let attempt = 0; attempt < 3 && !invoice; attempt++) {
        try {
          invoice = await prisma.$transaction(async (tx) => {
            const claimed = await tx.recurringInvoice.updateMany({
              where: { id: schedule.id, nextRunDate: schedule.nextRunDate },
              data: { nextRunDate: advanceDate(schedule.nextRunDate, schedule.frequency) }
            });
            if (claimed.count === 0) return null; // someone else already ran this cycle

            const invoiceNumber = await generateInvoiceNumber(schedule.workspaceId);
            const inv = await tx.invoice.create({
              data: {
                workspaceId: schedule.workspaceId,
                userId: schedule.workspace.createdBy,
                clientId: schedule.clientId,
                invoiceNumber,
                status: 'pending',
                issueDate,
                dueDate,
                discount: schedule.discount,
                notes: schedule.notes || null,
                recurringId: schedule.id,
                items: {
                  create: schedule.items.map((it) => ({
                    description: it.description,
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                    productId: it.productId || null
                  }))
                },
                auditLogs: { create: { type: 'created', message: 'Auto-created from recurring schedule' } }
              }
            });
            await tx.recurringInvoice.update({
              where: { id: schedule.id },
              data: { lastRunAt: new Date() }
            });
            return inv;
          });
        } catch (err) {
          const isCollision = err.code === 'P2002' && err.meta?.target?.includes('invoiceNumber');
          if (!isCollision || attempt === 2) throw err;
        }
      }

      if (!invoice) continue; // claimed by another runner

      await notifyWorkspace({
        workspaceId: schedule.workspaceId,
        type: 'invoice_created',
        title: 'Recurring invoice created',
        message: `${invoice.invoiceNumber} auto-generated for ${schedule.client.name}`,
        invoiceId: invoice.id
      });
      created++;
    } catch (err) {
      console.error(`[scheduler] failed to materialize schedule ${schedule.id}:`, err.message);
    }
  }

  return created;
}

// Flag invoices that became overdue with one notification per invoice (only
// the first time — repeated nudges are manual "Send Reminder" actions).
async function checkOverdueInvoices({ workspaceId = null } = {}) {
  const where = { status: { in: ['pending', 'partially_paid'] }, dueDate: { lt: new Date() } };
  if (workspaceId) where.workspaceId = workspaceId;

  const overdue = await prisma.invoice.findMany({
    where,
    include: { client: { select: { name: true } } }
  });
  if (overdue.length === 0) return 0;

  const existing = await prisma.notification.findMany({
    where: { type: 'overdue', ...(workspaceId ? { workspaceId } : {}) },
    select: { invoiceId: true }
  });
  const flagged = new Set(existing.map((n) => n.invoiceId));
  const fresh = overdue.filter((inv) => !flagged.has(inv.id));

  for (const inv of fresh) {
    await notifyWorkspace({
      workspaceId: inv.workspaceId,
      type: 'overdue',
      title: 'Invoice overdue',
      message: `${inv.invoiceNumber} for ${inv.client.name} is now overdue`,
      invoiceId: inv.id
    });
  }
  return fresh.length;
}

let started = false;

function startScheduler() {
  if (started) return;
  started = true;

  const runRecurring = async () => {
    try {
      const n = await generateDueRecurring();
      if (n > 0) console.log(`[scheduler] materialized ${n} recurring invoice(s)`);
    } catch (err) {
      console.error('[scheduler] recurring pass failed:', err.message);
    }
  };

  const runOverdue = async () => {
    try {
      const n = await checkOverdueInvoices();
      if (n > 0) console.log(`[scheduler] flagged ${n} overdue invoice(s)`);
    } catch (err) {
      console.error('[scheduler] overdue pass failed:', err.message);
    }
  };

  setInterval(runRecurring, 60 * 1000);
  setInterval(runOverdue, 10 * 60 * 1000);
  setTimeout(runRecurring, 5000);
  setTimeout(runOverdue, 8000);
}

module.exports = { generateDueRecurring, checkOverdueInvoices, startScheduler };