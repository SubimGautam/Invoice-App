const prisma = require('../prisma');

// Maps a notification event type to the workspace setting that gates it, so the
// "Email/Payment/Reminder notifications" toggles in Settings actually control
// what lands in the team's notification feed. Every type not listed here is
// treated as general activity (gated by emailNotifications).
const TYPE_TO_SETTING = {
  payment: 'paymentNotifications',
  invoice_paid: 'paymentNotifications',
  refund: 'paymentNotifications',
  reminder_sent: 'reminderNotifications',
  reminders_batch: 'reminderNotifications',
  overdue: 'reminderNotifications',
  invoice_sent: 'emailNotifications',
  invoice_created: 'emailNotifications',
  // Estimates are quotes, not billing events: creating/sending/answering one
  // is general workspace activity, gated by the activity toggle.
  estimate_created: 'emailNotifications',
  estimate_sent: 'emailNotifications',
  estimate_accepted: 'emailNotifications',
  estimate_declined: 'emailNotifications',
  estimate_converted: 'emailNotifications'
};

// True when the workspace's notification preferences allow this event through.
async function notificationsEnabled(workspaceId, type) {
  const setting = TYPE_TO_SETTING[type] || 'emailNotifications';
  const settings = await prisma.workspaceSettings
    .findUnique({ where: { workspaceId } })
    .catch(() => null);
  // Missing settings row → defaults to on (upsert elsewhere keeps this in sync).
  return settings ? settings[setting] !== false : true;
}

// Create a notification for every member of a workspace. In a solo workspace
// the actor IS the team, so they receive their own activity (the feed doubles
// as an activity log). In a multi-member workspace the actor is excluded so
// people aren't pinged about their own clicks. Used by event hooks like
// "payment recorded" / "invoice sent". Honors the workspace's notification
// preference toggles — turning one off stops that category of event entirely.
// Set exactly one of invoiceId / estimateId so the feed row links somewhere.
async function notifyWorkspace({ workspaceId, excludeUserId = null, type, title, message, invoiceId = null, estimateId = null }) {
  if (!(await notificationsEnabled(workspaceId, type))) return;
  const members = await prisma.membership.findMany({ where: { workspaceId }, select: { userId: true } });
  let recipients;
  if (members.length === 1) {
    recipients = members.map((m) => m.userId);
  } else {
    recipients = members.filter((m) => m.userId !== excludeUserId).map((m) => m.userId);
  }
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients.map((userId) => ({ userId, workspaceId, type, title, message, invoiceId, estimateId }))
  });
}

// Create a notification for one specific user (e.g. reminder fires addressed
// to the member who runs the workspace).
async function notifyUser({ userId, workspaceId, type, title, message, invoiceId = null, estimateId = null }) {
  if (!(await notificationsEnabled(workspaceId, type))) return;
  await prisma.notification.create({ data: { userId, workspaceId, type, title, message, invoiceId, estimateId } });
}

module.exports = { notifyWorkspace, notifyUser };