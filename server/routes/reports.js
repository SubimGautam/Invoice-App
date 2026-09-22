const express = require('express');
const prisma = require('../prisma');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Shared money math — see lib/money.js. Discount is applied before tax so
// reports and the dashboard agree:
//   total = (subtotal − discount) × (1 + taxRate/100)
const { invoiceTotal } = require('../lib/money');

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'short' });
}

function pctChange(curr, prev) {
  if (prev > 0) return ((curr - prev) / prev) * 100;
  return curr > 0 ? 100 : 0;
}

// GET /api/reports?months=12 — every number here is computed from real
// invoices/clients. Nothing here is simulated: no multi-currency FX, no
// VAT-by-jurisdiction, no 1099 deductions — this app doesn't track those,
// so they're not represented.
router.get('/', async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months) || 12, 1), 36);
  const now = new Date();

  const periodStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1));
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); // exclusive, end of this month
  const prevPeriodStart = startOfMonth(new Date(periodStart.getFullYear(), periodStart.getMonth() - months, 1));
  const prevPeriodEnd = periodStart; // exclusive

  const [settings, allInvoices] = await Promise.all([
    prisma.workspaceSettings.upsert({ where: { workspaceId: req.workspaceId }, update: {}, create: { workspaceId: req.workspaceId } }),
    prisma.invoice.findMany({
      where: { workspaceId: req.workspaceId },
      include: { items: true, client: { select: { id: true, name: true } } }
    })
  ]);

  const taxRate = Number(settings.defaultTaxRate || 0);

  // --- Snapshot metrics: current outstanding receivables + aging (not period-bound) ---
  const pendingInvoices = allInvoices.filter((inv) => inv.status === 'pending');
  const agingReceivablesTotal = pendingInvoices.reduce((s, inv) => s + invoiceTotal(inv, taxRate), 0);

  const buckets = [
    { key: 'current', label: 'Current (0–30 Days)', min: 0, max: 30, total: 0, count: 0 },
    { key: 'd31_60', label: '31–60 Days', min: 31, max: 60, total: 0, count: 0 },
    { key: 'd61_90', label: '61–90 Days', min: 61, max: 90, total: 0, count: 0 },
    { key: 'd90plus', label: '90+ Days Overdue', min: 91, max: Infinity, total: 0, count: 0 }
  ];
  for (const inv of pendingInvoices) {
    const daysOverdue = Math.max(0, Math.floor((now - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24)));
    const bucket = buckets.find((b) => daysOverdue >= b.min && daysOverdue <= b.max);
    const total = invoiceTotal(inv, taxRate);
    bucket.total += total;
    bucket.count += 1;
  }
  const bucketsOut = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    total: b.total,
    count: b.count,
    pct: agingReceivablesTotal > 0 ? (b.total / agingReceivablesTotal) * 100 : 0
  }));

  // --- Period-bound metrics ---
  function metricsForRange(start, end) {
    const inRange = allInvoices.filter(
      (inv) => inv.status !== 'draft' && new Date(inv.issueDate) >= start && new Date(inv.issueDate) < end
    );
    const billedTotal = inRange.reduce((s, inv) => s + invoiceTotal(inv, taxRate), 0);
    const paidInRange = inRange.filter((inv) => inv.status === 'paid');
    const collectedTotal = paidInRange.reduce((s, inv) => s + invoiceTotal(inv, taxRate), 0);
    const collectionRate = billedTotal > 0 ? (collectedTotal / billedTotal) * 100 : 0;

    const dsoList = paidInRange
      .filter((inv) => inv.paidAt)
      .map((inv) => (new Date(inv.paidAt) - new Date(inv.issueDate)) / (1000 * 60 * 60 * 24));
    const avgDSO = dsoList.length ? dsoList.reduce((a, b) => a + b, 0) / dsoList.length : 0;

    return { billedTotal, collectedTotal, collectionRate, avgDSO, paidCount: paidInRange.length };
  }

  const current = metricsForRange(periodStart, periodEnd);
  const previous = metricsForRange(prevPeriodStart, prevPeriodEnd);

  // --- Monthly chart series (billed vs. actually collected, by month) ---
  const chart = [];
  for (let i = months - 1; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const billed = allInvoices
      .filter((inv) => inv.status !== 'draft' && new Date(inv.issueDate) >= mStart && new Date(inv.issueDate) < mEnd)
      .reduce((s, inv) => s + invoiceTotal(inv, taxRate), 0);
    const collected = allInvoices
      .filter((inv) => inv.status === 'paid' && inv.paidAt && new Date(inv.paidAt) >= mStart && new Date(inv.paidAt) < mEnd)
      .reduce((s, inv) => s + invoiceTotal(inv, taxRate), 0);
    chart.push({ month: monthLabel(mStart), billed, collected });
  }

  // --- Top clients within the selected period ---
  const clientMap = new Map();
  for (const inv of allInvoices) {
    if (inv.status === 'draft') continue;
    if (new Date(inv.issueDate) < periodStart || new Date(inv.issueDate) >= periodEnd) continue;
    const key = inv.client.id;
    if (!clientMap.has(key)) {
      clientMap.set(key, { id: key, name: inv.client.name, invoiceCount: 0, totalBilled: 0, realizedCash: 0, dsoSamples: [] });
    }
    const entry = clientMap.get(key);
    const total = invoiceTotal(inv, taxRate);
    entry.invoiceCount += 1;
    entry.totalBilled += total;
    if (inv.status === 'paid') {
      entry.realizedCash += total;
      if (inv.paidAt) entry.dsoSamples.push((new Date(inv.paidAt) - new Date(inv.issueDate)) / (1000 * 60 * 60 * 24));
    }
  }
  const allPeriodClients = Array.from(clientMap.values());
  const grandTotalBilled = allPeriodClients.reduce((s, c) => s + c.totalBilled, 0);
  const topClients = allPeriodClients
    .map((c) => ({
      id: c.id,
      name: c.name,
      invoiceCount: c.invoiceCount,
      totalBilled: c.totalBilled,
      realizedCash: c.realizedCash,
      avgDSO: c.dsoSamples.length ? c.dsoSamples.reduce((a, b) => a + b, 0) / c.dsoSamples.length : null,
      shareOfRevenuePct: grandTotalBilled > 0 ? (c.totalBilled / grandTotalBilled) * 100 : 0
    }))
    .sort((a, b) => b.totalBilled - a.totalBilled)
    .slice(0, 5);

  // collectedTotal already includes VAT, so the tax slice of a tax-inclusive
  // amount is total × rate / (100 + rate).
  const estTaxReserve = current.collectedTotal * (taxRate / (100 + taxRate));

  res.json({
    period: {
      months,
      startDate: periodStart,
      endDate: now,
      label: `Last ${months} Month${months > 1 ? 's' : ''} (${monthLabel(periodStart)} ${periodStart.getFullYear()} \u2013 ${monthLabel(now)} ${now.getFullYear()})`
    },
    currency: settings.currency,
    kpis: {
      revenueCollected: current.collectedTotal,
      revenueCollectedChangePct: pctChange(current.collectedTotal, previous.collectedTotal),
      paidInvoiceCount: current.paidCount,
      agingReceivablesTotal,
      openInvoiceCount: pendingInvoices.length,
      avgDSO: current.avgDSO,
      collectionRate: current.collectionRate,
      collectionRateChangePct: pctChange(current.collectionRate, previous.collectionRate),
      estTaxReserve,
      taxRate
    },
    chart,
    aging: {
      buckets: bucketsOut,
      totalOutstanding: agingReceivablesTotal,
      openInvoiceCount: pendingInvoices.length
    },
    topClients,
    totalClientsInPeriod: allPeriodClients.length
  });
});

module.exports = router;