const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const itemSchema = z.object({
  description: z.string().min(1, 'Item description is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative')
});

const invoiceSchema = z.object({
  clientId: z.string().uuid('A valid client is required'),
  issueDate: z.string().datetime().or(z.string().min(1)),
  dueDate: z.string().datetime().or(z.string().min(1)),
  notes: z.string().optional(),
  status: z.enum(['draft', 'pending']).optional().default('draft'),
  items: z.array(itemSchema).min(1, 'At least one line item is required')
});

// Helper: generate a simple unique invoice number per user
async function generateInvoiceNumber(userId) {
  const count = await prisma.invoice.count({ where: { userId } });
  return `INV-${String(count + 1).padStart(4, '0')}`;
}

// GET /api/invoices — list invoices, optional ?status=draft|pending|paid filter
router.get('/', async (req, res) => {
  const { status } = req.query;

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const where = { userId: req.userId };
  if (status) {
    const validStatuses = ['draft', 'pending', 'paid', 'overdue'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }
    if (status === 'overdue') {
      where.status = 'pending';
      where.dueDate = { lt: new Date() };
    } else {
      where.status = status;
    }
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { client: true, items: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.invoice.count({ where })
  ]);

  res.json({
    invoices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// GET /api/invoices/:id — single invoice with client and items
router.get('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: Number(req.params.id) },
    include: { client: true, items: true }
  });

  if (!invoice || invoice.userId !== req.userId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  res.json(invoice);
});

// POST /api/invoices — create invoice + line items together
router.post('/', async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { clientId, issueDate, dueDate, notes, status, items } = parsed.data;

  // Confirm the client belongs to this user before attaching an invoice to it
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.userId !== req.userId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  const invoiceNumber = await generateInvoiceNumber(req.userId);

  const invoice = await prisma.invoice.create({
    data: {
      userId: req.userId,
      clientId,
      invoiceNumber,
      status,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      notes,
      items: {
        create: items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      }
    },
    include: { client: true, items: true }
  });

  res.status(201).json(invoice);
});

// GET /api/invoices/stats — real counts + dollar totals across ALL invoices, not just one page
router.get('/stats', async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { userId: req.userId },
    select: {
      status: true,
      dueDate: true,
      items: { select: { quantity: true, unitPrice: true } }
    }
  });

  const now = new Date();
  const counts = { all: 0, draft: 0, pending: 0, paid: 0, overdue: 0 };
  const sums = { totalOutstanding: 0, paidThisMonth: 0, overdueTotal: 0, draftsTotal: 0 };

  for (const inv of invoices) {
    const total = inv.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
    const isOverdue = inv.status === 'pending' && new Date(inv.dueDate) < now;

    counts.all++;

    if (inv.status === 'draft') {
      counts.draft++;
      sums.draftsTotal += total;
    } else if (inv.status === 'paid') {
      counts.paid++;
      sums.paidThisMonth += total;
    } else if (isOverdue) {
      counts.overdue++;
      sums.overdueTotal += total;
      sums.totalOutstanding += total;
    } else if (inv.status === 'pending') {
      counts.pending++;
      sums.totalOutstanding += total;
    }
  }

  res.json({ counts, sums });
});

// PUT /api/invoices/:id — update invoice + replace line items
router.put('/:id', async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const existing = await prisma.invoice.findUnique({ where: { id: Number(req.params.id) } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (existing.status === 'paid') {
    return res.status(400).json({ error: 'Paid invoices cannot be edited' });
  }

  const { clientId, issueDate, dueDate, notes, status, items } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.userId !== req.userId) {
    return res.status(404).json({ error: 'Client not found' });
  }

  // Replace items: delete old ones, create the new set, in a single transaction
  const [, , updated] = await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId: existing.id } }),
    prisma.invoice.update({
      where: { id: existing.id },
      data: {
        clientId,
        status,
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        notes
      }
    }),
    prisma.invoice.update({
      where: { id: existing.id },
      data: {
        items: {
          create: items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        }
      },
      include: { client: true, items: true }
    })
  ]);

  res.json(updated);
});

// PATCH /api/invoices/:id/status — mark a pending invoice as paid
router.patch('/:id/status', async (req, res) => {
  const statusSchema = z.object({
    status: z.enum(['draft', 'pending', 'paid'])
  });

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice || invoice.userId !== req.userId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (invoice.status === 'paid') {
    return res.status(400).json({ error: 'Paid invoices cannot change status' });
  }

  const updateData = { status: parsed.data.status };
  if (parsed.data.status === 'paid') {
    updateData.paidAt = new Date();
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: updateData,
    include: { client: true, items: true }
  });

  res.json(updated);
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: Number(req.params.id) } });
  if (!invoice || invoice.userId !== req.userId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  await prisma.invoice.delete({ where: { id: invoice.id } });
  res.status(204).send();
});

module.exports = router;