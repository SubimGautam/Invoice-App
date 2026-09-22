const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roles');
const { generateDueRecurring } = require('../lib/scheduler');

const router = express.Router();
router.use(requireAuth);

const itemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  productId: z.string().uuid('A valid product is required').optional()
});

const recurringSchema = z.object({
  clientId: z.string().uuid('A valid client is required'),
  description: z.string().optional(),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  startDate: z.string().datetime().or(z.string().min(1)),
  discount: z.number().nonnegative('Discount cannot be negative').optional().default(0),
  notes: z.string().optional(),
  active: z.boolean().optional().default(true),
  items: z.array(itemSchema).min(1, 'At least one line item is required')
});

// next billing run starts at startDate (if still ahead) else today.
function initialNextRun(startDate) {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start > today ? start : today;
}

// GET /api/recurring — this workspace's schedules with client + template items.
router.get('/', async (req, res) => {
  const schedules = await prisma.recurringInvoice.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { createdAt: 'desc' },
    include: { client: true, items: true }
  });
  res.json(schedules);
});

// POST /api/recurring — create a schedule.
router.post('/', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = recurringSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client || client.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const schedule = await prisma.recurringInvoice.create({
    data: {
      workspaceId: req.workspaceId,
      clientId: parsed.data.clientId,
      description: parsed.data.description || null,
      frequency: parsed.data.frequency,
      startDate: new Date(parsed.data.startDate),
      nextRunDate: initialNextRun(parsed.data.startDate),
      discount: parsed.data.discount,
      notes: parsed.data.notes || null,
      active: parsed.data.active,
      items: {
        create: parsed.data.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          productId: it.productId || null
        }))
      }
    },
    include: { client: true, items: true }
  });

  res.status(201).json(schedule);
});

async function findOwned(scheduleId, workspaceId) {
  const schedule = await prisma.recurringInvoice.findUnique({
    where: { id: scheduleId },
    include: { client: true, items: true }
  });
  if (!schedule || schedule.workspaceId !== workspaceId) return null;
  return schedule;
}

// PUT /api/recurring/:id — replace everything except the run history.
router.put('/:id', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = recurringSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const schedule = await findOwned(req.params.id, req.workspaceId);
  if (!schedule) return res.status(404).json({ error: 'Recurring schedule not found' });

  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client || client.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const [, updated] = await prisma.$transaction([
    prisma.recurringItem.deleteMany({ where: { recurringInvoiceId: schedule.id } }),
    prisma.recurringInvoice.update({
      where: { id: schedule.id },
      data: {
        clientId: parsed.data.clientId,
        description: parsed.data.description || null,
        frequency: parsed.data.frequency,
        startDate: new Date(parsed.data.startDate),
        discount: parsed.data.discount,
        notes: parsed.data.notes || null,
        active: parsed.data.active,
        items: {
          create: parsed.data.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            productId: it.productId || null
          }))
        }
      },
      include: { client: true, items: true }
    })
  ]);

  res.json(updated);
});

// PATCH /api/recurring/:id/active — pause / resume.
router.patch('/:id/active', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const schedule = await findOwned(req.params.id, req.workspaceId);
  if (!schedule) return res.status(404).json({ error: 'Recurring schedule not found' });
  const updated = await prisma.recurringInvoice.update({
    where: { id: schedule.id },
    data: { active: parsed.data.active }
  });
  res.json(updated);
});

// DELETE /api/recurring/:id
router.delete('/:id', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const schedule = await findOwned(req.params.id, req.workspaceId);
  if (!schedule) return res.status(404).json({ error: 'Recurring schedule not found' });
  await prisma.recurringInvoice.delete({ where: { id: schedule.id } });
  res.status(204).send();
});

// POST /api/recurring/generate-due — materialize any due invoices NOW (the
// scheduler auto-runs this; exposed for manual "Generate now" + tests).
router.post('/generate-due', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const created = await generateDueRecurring({ workspaceId: req.workspaceId });
  res.json({ created });
});

module.exports = router;