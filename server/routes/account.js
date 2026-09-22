const express = require('express');
const path = require('path');
const fs = require('fs');
const { z } = require('zod');
const multer = require('multer');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { smtpConfigured } = require('../lib/mailer');

const router = express.Router();
router.use(requireAuth);

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Shared multer config for avatar + logo uploads: images only, max 3 MB.
const imageFilter = (req, file, cb) => {
  if (file.mimetype && ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG, JPEG, WEBP or GIF images can be uploaded'));
  }
};

function makeUploader(subdir, prefix) {
  return multer({
    storage: multer.diskStorage({
      destination: path.join(UPLOADS_DIR, subdir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.png';
        cb(null, `${prefix}-${Date.now()}${ext}`);
      }
    }),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: imageFilter
  }).single('file');
}

// Wrap a multer middleware so size/type errors come back as clean 400s
// instead of crashing into the global error handler.
function uploadMiddleware(uploader) {
  return (req, res, next) => {
    uploader(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
      next();
    });
  };
}

// Delete an uploaded file when it's replaced or removed (best-effort; the
// DB row is the source of truth, so a failed unlink is harmless).
function removeUpload(pathname) {
  if (!pathname || !pathname.startsWith('/uploads/')) return;
  const full = path.join(UPLOADS_DIR, pathname.replace('/uploads/', ''));
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

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

// POST /api/account/avatar — upload the caller's own profile picture.
// Multipart field name: file. Returns the fresh user object.
router.post('/avatar', uploadMiddleware(makeUploader('avatars', 'avatar')), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  const old = await prisma.user.findUnique({ where: { id: req.userId }, select: { avatarUrl: true } });
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatarUrl },
    select: { id: true, name: true, email: true, avatarUrl: true }
  });
  removeUpload(old?.avatarUrl); // clean up the replaced picture
  res.json({ user });
});

// DELETE /api/account/avatar — drop the caller's profile picture.
router.delete('/avatar', async (req, res) => {
  const old = await prisma.user.findUnique({ where: { id: req.userId }, select: { avatarUrl: true } });
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatarUrl: null },
    select: { id: true, name: true, email: true, avatarUrl: true }
  });
  removeUpload(old?.avatarUrl);
  res.json({ user });
});

// POST /api/account/logo — upload the workspace's business logo (shown on
// invoices/PDFs). Shared by the whole team, so owner/admin only.
router.post('/logo', requireRole('owner', 'admin'), uploadMiddleware(makeUploader('logos', 'logo')), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const logoUrl = `/uploads/logos/${req.file.filename}`;

  const old = await prisma.businessProfile.findUnique({ where: { workspaceId: req.workspaceId }, select: { logoUrl: true } });
  const profile = await prisma.businessProfile.upsert({
    where: { workspaceId: req.workspaceId },
    update: { logoUrl },
    create: { workspaceId: req.workspaceId, userId: req.userId, businessName: 'My Business', logoUrl }
  });
  removeUpload(old?.logoUrl);
  res.json(profile);
});

// DELETE /api/account/logo — remove the workspace's business logo.
router.delete('/logo', requireRole('owner', 'admin'), async (req, res) => {
  const old = await prisma.businessProfile.findUnique({ where: { workspaceId: req.workspaceId }, select: { logoUrl: true } });
  if (!old) {
    return res.status(404).json({ error: 'No business logo to remove' });
  }
  const profile = await prisma.businessProfile.update({
    where: { workspaceId: req.workspaceId },
    data: { logoUrl: null }
  });
  removeUpload(old.logoUrl);
  res.json(profile);
});

module.exports = router;