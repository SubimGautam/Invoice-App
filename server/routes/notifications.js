const express = require('express');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { checkOverdueInvoices } = require('../lib/scheduler');

const router = express.Router();
router.use(requireAuth);

// GET /api/notifications — the caller's own feed (across their workspaces'.
// The bell in the app shows the active workspace's events.
// Query: ?page=N&limit=M — returns { notifications, total, unreadCount, page, limit }.
router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const where = { userId: req.userId, workspaceId: req.workspaceId };
  // Notification messages already embed the invoice number, and invoiceId
  // lets the UI link through to the invoice — no relation needed.
  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, readAt: null } })
  ]);
  res.json({ notifications, total, unreadCount, page, limit });
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.userId, workspaceId: req.workspaceId, readAt: null }
  });
  res.json({ count });
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', async (req, res) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  // Scoped to both the owner AND the active workspace — a user switching between
  // workspaces must only act on the feed they're currently viewing.
  if (!notification || notification.userId !== req.userId || notification.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() }
  });
  res.json(updated);
});

// PATCH /api/notifications/read-all — mark the whole workspace feed as read
router.patch('/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId, workspaceId: req.workspaceId, readAt: null },
    data: { readAt: new Date() }
  });
  res.json({ ok: true });
});

// POST /api/notifications/scan — run the overdue-check now (the scheduler does
// this periodically; exposed for manual/testing use).
router.post('/scan', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const created = await checkOverdueInvoices({ workspaceId: req.workspaceId });
  res.json({ created });
});

module.exports = router;