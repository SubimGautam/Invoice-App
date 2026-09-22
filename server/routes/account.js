const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { smtpConfigured } = require('../lib/mailer');

const router = express.Router();
router.use(requireAuth);

const profileSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  taxNumber: z.string().optional(),
  logoUrl: z.string().optional(),
  bankName: z.string().optional(),
  routingNumber: z.string().optional(),
  accountNumber: z.string().optional()
});

const settingsSchema = z.object({
  currency: z.string().min(1).optional(),
  defaultPaymentTerms: z.number().int().nonnegative().optional(),
  invoicePrefix: z.string().min(1).optional(),
  defaultTaxRate: z.number().nonnegative().optional(),
  emailNotifications: z.boolean().optional(),
  paymentNotifications: z.boolean().optional(),
  reminderNotifications: z.boolean().optional()
});

// GET /api/account/profile — the ACTIVE workspace's business identity.
router.get('/profile', async (req, res) => {
  const profile = await prisma.businessProfile.findUnique({
    where: { workspaceId: req.workspaceId }
  });
  res.json(profile); // null if not yet created — frontend treats that as "not set up"
});

// PUT /api/account/profile — create or update (upsert). The business identity
// is shared by the whole workspace, so only owner/admin can change it.
router.put('/profile', requireRole('owner', 'admin'), async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const profile = await prisma.businessProfile.upsert({
    where: { workspaceId: req.workspaceId },
    update: parsed.data,
    create: { ...parsed.data, workspaceId: req.workspaceId, userId: req.userId }
  });

  res.json(profile);
});

// GET /api/account/settings — workspace settings, auto-created on first access.
router.get('/settings', async (req, res) => {
  const settings = await prisma.workspaceSettings.upsert({
    where: { workspaceId: req.workspaceId },
    update: {},
    create: { workspaceId: req.workspaceId }
  });
  res.json(settings);
});

// PUT /api/account/settings — owner/admin only (team-shared numbers/counters).
router.put('/settings', requireRole('owner', 'admin'), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const settings = await prisma.workspaceSettings.upsert({
    where: { workspaceId: req.workspaceId },
    update: parsed.data,
    create: { ...parsed.data, workspaceId: req.workspaceId }
  });

  res.json(settings);
});

// GET /api/account/email-status — whether SMTP is configured. Drives UI hints
// ("Emails will actually be sent" vs "Simulated in console").
router.get('/email-status', async (req, res) => {
  res.json({ configured: smtpConfigured() });
});

module.exports = router;