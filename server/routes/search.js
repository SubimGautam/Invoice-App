const express = require('express');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');
const { invoiceTotal } = require('../lib/money');

const router = express.Router();
router.use(requireAuth);

// GET /api/search?q= — workspace-scoped global search powering the topbar bar.
// Returns matching invoices, clients, and products so the dropdown can link
// straight into the right page. Amounts work too: typing a number matches
// invoice totals exactly.
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.json({ invoices: [], clients: [], products: [] });
  }

  const [settings] = await Promise.all([
    prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } })
  ]);
  const taxRate = Number(settings.defaultTaxRate || 0);
  const contains = { contains: q, mode: 'insensitive' };

  const searchedAmount = !Number.isNaN(Number(q)) && /^\d+(\.\d+)?$/.test(q) ? Number(q) : null;

  // Invoices: match number, client name, or exact total (when the query is an amount).
  const invoices = await prisma.invoice.findMany({
    where: { workspaceId: req.workspaceId },
    include: { client: true, items: true, payments: { select: { amount: true, paymentDate: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300
  });
  const invoiceMatches = invoices
    .filter((inv) => {
      if (
        inv.invoiceNumber.toLowerCase().includes(q.toLowerCase()) ||
        inv.client.name.toLowerCase().includes(q.toLowerCase())
      ) {
        return true;
      }
      if (searchedAmount !== null && Math.abs(invoiceTotal(inv, taxRate) - searchedAmount) < 0.01) {
        return true;
      }
      return false;
    })
    .slice(0, 5)
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.client.name,
      total: invoiceTotal(inv, taxRate),
      status: inv.status
    }));

  const [clients, products] = await Promise.all([
    prisma.client.findMany({
      where: {
        workspaceId: req.workspaceId,
        OR: [{ name: contains }, { companyName: contains }, { email: contains }]
      },
      include: { _count: { select: { invoices: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    prisma.product.findMany({
      where: { workspaceId: req.workspaceId, name: contains },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
  ]);

  res.json({
    invoices: invoiceMatches,
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      companyName: c.companyName,
      email: c.email,
      invoiceCount: c._count.invoices
    })),
    products: products.map((p) => ({ id: p.id, name: p.name }))
  });
});

module.exports = router;