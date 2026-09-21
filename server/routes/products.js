const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // every route below requires a valid token

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().nonnegative('Price cannot be negative'),
  taxRate: z.number().nonnegative('Tax rate cannot be negative').optional().default(0),
  unit: z.string().optional(),
  stock: z.number().int().nonnegative('Stock cannot be negative').optional().default(0),
  category: z.string().optional()
});

// GET /api/products — list the logged-in user's catalog
router.get('/', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { userId: req.userId },
    orderBy: { name: 'asc' }
  });
  res.json(products);
});

// POST /api/products — create a product
router.post('/', async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const product = await prisma.product.create({
    data: { ...parsed.data, userId: req.userId }
  });

  res.status(201).json(product);
});

// PUT /api/products/:id — update a product
router.put('/:id', async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const product = await prisma.product.findUnique({
    where: { id: req.params.id }
  });

  if (!product || product.userId !== req.userId) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: parsed.data
  });

  res.json(updated);
});

// DELETE /api/products/:id — delete a product. Historical invoice line items
// that reference it stay intact (productId is set to NULL, not removed).
router.delete('/:id', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id }
  });

  if (!product || product.userId !== req.userId) {
    return res.status(404).json({ error: 'Product not found' });
  }

  await prisma.product.delete({ where: { id: product.id } });
  res.status(204).send();
});

module.exports = router;