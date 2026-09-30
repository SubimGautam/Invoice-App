const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../prisma');
const { sendEmail } = require('../lib/mailer');
const { passwordResetEmail } = require('../lib/emailTemplates');

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
    user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
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
    user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    workspace: { id: membership.workspace.id, name: membership.workspace.name, role: membership.role }
  });
});

// POST /api/auth/forgot-password — starts the password reset flow. We ALWAYS
// return the same message whether or not the account exists (no user
// enumeration). When an account exists we mint a single-use reset token (stored
// as a SHA-256 hash with a 1h expiry) and email a reset link through the
// app's mailer — which simulates + logs when SMTP isn't configured.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Always pretend to work; only send when the account actually exists.
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        passwordResetExpiresAt: expiresAt
      }
    });

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    const { subject, html } = passwordResetEmail({ resetUrl });
    const membership = await prisma.membership.findFirst({ where: { userId: user.id } });
    if (membership) {
      await sendEmail({
        workspaceId: membership.workspaceId,
        userId: user.id,
        type: 'password_reset',
        to: user.email,
        subject,
        html
      }).catch((err) => console.error('[auth] reset email failed:', err.message));
    } else {
      console.log(`[auth] reset link for ${user.email} (no workspace to log to): ${resetUrl}`);
    }
  }

  res.json({
    ok: true,
    message: 'If an account exists for that email, a password reset link is on its way.'
  });
});

// POST /api/auth/reset-password — exchanges a reset token for a new password.
// The token is single-use: it's cleared the moment it's consumed, and it
// expires after 1 hour regardless.
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'Reset token is missing or invalid' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: { gt: new Date() }
    }
  });
  if (!user) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null }
  });

  res.json({ ok: true, message: 'Password updated. You can now sign in with your new password.' });
});

module.exports = router;