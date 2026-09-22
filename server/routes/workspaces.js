const express = require('express');
const { randomBytes } = require('crypto');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roles');

const router = express.Router();
router.use(requireAuth);

function issueToken(userId, workspaceId) {
  return jwt.sign({ userId, workspaceId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// GET /api/workspaces — every workspace the user belongs to, with their role.
router.get('/', async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'asc' },
    include: { workspace: true }
  });
  res.json(
    memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
      active: m.workspaceId === req.workspaceId
    }))
  );
});

// POST /api/workspaces — create a new workspace; the caller becomes its owner
// and is immediately switched into it (fresh token in the response).
router.post('/', async (req, res) => {
  const parsed = z.object({ name: z.string().min(1, 'Workspace name is required') }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({ data: { name: parsed.data.name, createdBy: req.userId } });
    await tx.membership.create({ data: { workspaceId: ws.id, userId: req.userId, role: 'owner' } });
    await tx.workspaceSettings.create({ data: { workspaceId: ws.id } });
    return ws;
  });

  res.status(201).json({
    workspace: { id: workspace.id, name: workspace.name, role: 'owner' },
    token: issueToken(req.userId, workspace.id)
  });
});

// POST /api/workspaces/activate — switch the active workspace (reissues token).
router.post('/activate', async (req, res) => {
  const parsed = z.object({ workspaceId: z.string().uuid('A valid workspace is required') }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: parsed.data.workspaceId, userId: req.userId } },
    include: { workspace: true }
  });
  if (!membership) {
    return res.status(404).json({ error: 'You are not a member of that workspace' });
  }

  res.json({
    token: issueToken(req.userId, membership.workspaceId),
    workspace: { id: membership.workspace.id, name: membership.workspace.name, role: membership.role }
  });
});

// POST /api/workspaces/leave — remove YOURSELF from a workspace. Two hard
// guards keep the account usable afterwards:
//   1. An owner can only leave when another owner remains (a workspace must
//      always have exactly one acting owner after they go).
//   2. Nobody can leave their LAST workspace — with zero memberships every
//      workspace-scoped call (and login) would 401, stranding the account.
// Returns everything the user still belongs to so the UI can switch over.
router.post('/leave', async (req, res) => {
  const parsed = z.object({ workspaceId: z.string().uuid('A valid workspace is required') }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: parsed.data.workspaceId, userId: req.userId } }
  });
  if (!membership) {
    return res.status(404).json({ error: 'You are not a member of that workspace' });
  }

  if (membership.role === 'owner') {
    const ownerCount = await prisma.membership.count({
      where: { workspaceId: membership.workspaceId, role: 'owner' }
    });
    if (ownerCount <= 1) {
      return res.status(400).json({
        error: "You're the only owner — promote someone else to owner (or add a co-owner) before leaving."
      });
    }
  }

  const totalMemberships = await prisma.membership.count({ where: { userId: req.userId } });
  if (totalMemberships <= 1) {
    return res.status(400).json({
      error: 'This is your only workspace. Create another workspace first if you want to leave it.'
    });
  }

  await prisma.membership.delete({ where: { id: membership.id } });

  const remaining = await prisma.membership.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'asc' },
    include: { workspace: true }
  });

  res.json({
    left: true,
    leftWorkspaceId: membership.workspaceId,
    remainingWorkspaces: remaining.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.role }))
  });
});

// GET /api/workspaces/members — the team of the ACTIVE workspace.
router.get('/members', async (req, res) => {
  const members = await prisma.membership.findMany({
    where: { workspaceId: req.workspaceId },
    include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    orderBy: { createdAt: 'asc' }
  });
  res.json(
    members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user
    }))
  );
});

// POST /api/workspaces/invite — (owner/admin) generate/share the join code.
router.post('/invite', requireRole('owner', 'admin'), async (req, res) => {
  const code = randomBytes(5).toString('base64url').toUpperCase();
  const updated = await prisma.workspace.update({
    where: { id: req.workspaceId },
    data: { inviteCode: code }
  });
  res.json({ inviteCode: updated.inviteCode });
});

// POST /api/workspaces/join — join a workspace by invite code. The joining user
// becomes a staff member and is switched into the workspace.
router.post('/join', async (req, res) => {
  const parsed = z.object({ code: z.string().min(4, 'Invite code is required') }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const workspace = await prisma.workspace.findUnique({ where: { inviteCode: parsed.data.code.trim().toUpperCase() } });
  if (!workspace) {
    return res.status(404).json({ error: 'Invalid invite code' });
  }
  if (workspace.id === req.workspaceId) {
    return res.status(400).json({ error: 'You are already in this workspace' });
  }

  const existing = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: req.userId } }
  });
  if (existing) {
    return res.status(400).json({ error: 'You are already a member of this workspace' });
  }

  await prisma.membership.create({
    data: { workspaceId: workspace.id, userId: req.userId, role: 'staff' }
  });

  res.json({
    workspace: { id: workspace.id, name: workspace.name, role: 'staff' },
    token: issueToken(req.userId, workspace.id)
  });
});

// PATCH /api/workspaces/members/:id — (owner/admin) change a member's role.
// Owners can't be demoted or edited by anyone but themselves via another flow.
router.patch('/members/:id', requireRole('owner', 'admin'), async (req, res) => {
  const parsed = z.object({ role: z.enum(['owner', 'admin', 'staff', 'viewer']) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const membership = await prisma.membership.findUnique({
    where: { id: req.params.id },
    include: { workspace: true }
  });
  if (!membership || membership.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Member not found' });
  }
  if (membership.role === 'owner') {
    return res.status(400).json({ error: "The workspace owner's role cannot be changed" });
  }

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { role: parsed.data.role },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  res.json({ id: updated.id, role: updated.role, user: updated.user });
});

// DELETE /api/workspaces/members/:id — (owner/admin) remove a member. The owner
// cannot be removed, and the last owner cannot leave.
router.delete('/members/:id', requireRole('owner', 'admin'), async (req, res) => {
  const membership = await prisma.membership.findUnique({
    where: { id: req.params.id },
    include: { workspace: true }
  });
  if (!membership || membership.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Member not found' });
  }
  if (membership.role === 'owner') {
    return res.status(400).json({ error: 'The workspace owner cannot be removed' });
  }

  await prisma.membership.delete({ where: { id: membership.id } });
  res.status(204).send();
});

// PATCH /api/workspaces — (owner/admin) rename the active workspace.
router.patch('/', requireRole('owner', 'admin'), async (req, res) => {
  const parsed = z.object({ name: z.string().min(1, 'Workspace name is required') }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const updated = await prisma.workspace.update({
    where: { id: req.workspaceId },
    data: { name: parsed.data.name }
  });
  res.json({ id: updated.id, name: updated.name });
});

module.exports = router;