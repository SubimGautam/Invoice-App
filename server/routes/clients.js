const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // every route below requires a valid token

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  phone: z.string().optional()
});

// GET /api/clients — list all clients for the logged-in user
router.get('/', async (req, res) => {
  const clients = await prisma.client.findMany({
    where: { userId: req.userId },
    orderBy: { name: 'asc' }
  });
  res.json(clients);
});

// POST /api/clients — create a client
router.post('/', async (req, res) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const client = await prisma.client.create({
    data: { ...parsed.data, userId: req.userId }
  });

  res.status(201).json(client);
});

// PUT /api/clients/:id — update a client
router.put('/:id', async (req, res) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const client = await prisma.client.findUnique({
    where: { id: Number(req.params.id) }
  });

  if (!client || client.userId !== req.userId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: parsed.data
  });

  res.json(updated);
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: Number(req.params.id) }
  });

  if (!client || client.userId !== req.userId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  await prisma.client.delete({ where: { id: client.id } });
  res.status(204).send();
});

module.exports = router;