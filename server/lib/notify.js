const prisma = require('../prisma');

// Create a notification for every member of a workspace. In a solo workspace
// the actor IS the team, so they receive their own activity (the feed doubles
// as an activity log). In a multi-member workspace the actor is excluded so
// people aren't pinged about their own clicks. Used by event hooks like
// "payment recorded" / "invoice sent".
async function notifyWorkspace({ workspaceId, excludeUserId = null, type, title, message, invoiceId = null }) {
  const members = await prisma.membership.findMany({ where: { workspaceId }, select: { userId: true } });
  let recipients;
  if (members.length === 1) {
    recipients = members.map((m) => m.userId);
  } else {
    recipients = members.filter((m) => m.userId !== excludeUserId).map((m) => m.userId);
  }
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients.map((userId) => ({ userId, workspaceId, type, title, message, invoiceId }))
  });
}

// Create a notification for one specific user (e.g. reminder fires addressed
// to the member who runs the workspace).
async function notifyUser({ userId, workspaceId, type, title, message, invoiceId = null }) {
  await prisma.notification.create({ data: { userId, workspaceId, type, title, message, invoiceId } });
}

module.exports = { notifyWorkspace, notifyUser };