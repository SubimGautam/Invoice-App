const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../prisma');

const router = express.Router();

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessName: z.string().min(1, 'Business name is required'),
  businessEmail: z.string().email().optional().or(z.literal('')),
  businessPhone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function issueToken(userId, workspaceId) {
  return jwt.sign({ userId, workspaceId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/signup — creates the user, their first workspace (they become
// the owner), the workspace settings, and the business profile, all atomically.
router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const {
    name, email, password,
    businessName, businessEmail, businessPhone,
    street, city, state, zipCode, country
  } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { user, workspace } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash } });
    const workspace = await tx.workspace.create({
      data: { name: businessName || `${name}'s Workspace`, createdBy: user.id }
    });
    await tx.membership.create({
      data: { workspaceId: workspace.id, userId: user.id, role: 'owner' }
    });
    await tx.workspaceSettings.create({ data: { workspaceId: workspace.id } });
    await tx.businessProfile.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        businessName,
        email: businessEmail || null,
        phone: businessPhone || null,
        street: street || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        country: country || null
      }
    });
    return { user, workspace };
  });

  res.status(201).json({
    token: issueToken(user.id, workspace.id),
    user: { id: user.id, name: user.name, email: user.email },
    workspace: { id: workspace.id, name: workspace.name, role: 'owner' }
  });
});

// POST /api/auth/login — resolves the user's earliest workspace as the active
// one. Multi-workspace users can switch afterwards via /api/workspaces/activate.
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: { workspace: true }
  });
  if (!membership) {
    return res.status(401).json({ error: 'No workspace found for this account' });
  }

  res.json({
    token: issueToken(user.id, membership.workspaceId),
    user: { id: user.id, name: user.name, email: user.email },
    workspace: { id: membership.workspace.id, name: membership.workspace.name, role: membership.role }
  });
});

module.exports = router;