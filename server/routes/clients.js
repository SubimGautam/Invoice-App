const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/roles');

const router = express.Router();
router.use(requireAuth); // every route below requires a valid token

const { invoiceTotal, paidSum } = require('../lib/money');

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional()
});

// GET /api/clients — list all clients in the active workspace, each with a
// small financial summary (invoice count, billed, collected, outstanding).
router.get('/', async (req, res) => {
  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });
  const taxRate = Number(settings.defaultTaxRate || 0);

  const clients = await prisma.client.findMany({
    where: { workspaceId: req.workspaceId },
    orderBy: { name: 'asc' },
    include: { invoices: { include: { items: true, payments: true } } }
  });

  const formatted = clients.map((client) => {
    const stats = client.invoices.reduce(
      (acc, inv) => {
        const total = invoiceTotal(inv, taxRate);
        const paid = paidSum(inv.payments);
        acc.count += 1;
        acc.billed += total;
        acc.paid += paid;
        if (inv.status !== 'draft') acc.outstanding += Math.max(0, total - paid);
        return acc;
      },
      { count: 0, billed: 0, paid: 0, outstanding: 0 }
    );
    const { invoices, ...rest } = client; // don't ship every invoice in the list
    return { ...rest, stats };
  });

  res.json(formatted);
});

// GET /api/clients/:id — one client with their full invoice history (taxed
// totals attached) plus a financial summary for the customer detail page.
router.get('/:id', async (req, res) => {
  const settings = await prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } });
  const taxRate = Number(settings.defaultTaxRate || 0);

  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      invoices: {
        include: { items: true, payments: true },
        orderBy: { issueDate: 'desc' }
      }
    }
  });

  if (!client || client.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const invoices = client.invoices.map((inv) => ({
    ...inv,
    total: invoiceTotal(inv, taxRate),
    paid: paidSum(inv.payments)
  }));

  const summary = invoices.reduce(
    (acc, inv) => {
      acc.count += 1;
      acc.billed += inv.total;
      acc.paid += inv.paid;
      if (inv.status !== 'draft') acc.outstanding += Math.max(0, inv.total - inv.paid);
      return acc;
    },
    { count: 0, billed: 0, paid: 0, outstanding: 0 }
  );

  res.json({ ...client, invoices, summary });
});

// POST /api/clients — create a client (staff+)
router.post('/', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const client = await prisma.client.create({
    data: { ...parsed.data, userId: req.userId, workspaceId: req.workspaceId }
  });

  res.status(201).json(client);
});

// PUT /api/clients/:id — update a client (staff+)
router.put('/:id', requireRole('owner', 'admin', 'staff'), async (req, res) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const client = await prisma.client.findUnique({ where: { id: req.params.id } });

  if (!client || client.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: parsed.data
  });

  res.json(updated);
});

// DELETE /api/clients/:id (owner/admin only — destructive, cascades to their
// invoices and payment history)
router.delete('/:id', requireRole('owner', 'admin'), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });

  if (!client || client.workspaceId !== req.workspaceId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  await prisma.client.delete({ where: { id: client.id } });
  res.status(204).send();
});

module.exports = router;