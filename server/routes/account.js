const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const profileSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
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

// GET /api/account/profile
router.get('/profile', async (req, res) => {
  const profile = await prisma.businessProfile.findUnique({
    where: { userId: req.userId }
  });
  res.json(profile); // null if not yet created — frontend treats that as "not set up"
});

// PUT /api/account/profile — create or update (upsert)
router.put('/profile', async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const profile = await prisma.businessProfile.upsert({
    where: { userId: req.userId },
    update: parsed.data,
    create: { ...parsed.data, userId: req.userId }
  });

  res.json(profile);
});

// GET /api/account/settings — auto-creates defaults on first access
router.get('/settings', async (req, res) => {
  const settings = await prisma.userSettings.upsert({
    where: { userId: req.userId },
    update: {},
    create: { userId: req.userId }
  });
  res.json(settings);
});

// PUT /api/account/settings
router.put('/settings', async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const settings = await prisma.userSettings.upsert({
    where: { userId: req.userId },
    update: parsed.data,
    create: { ...parsed.data, userId: req.userId }
  });

  res.json(settings);
});

module.exports = router;