// Shared money math for the whole API. Every dollar figure in the app is
// derived from line items + discount (there's no stored "total" column), so
// all money math lives in one place to keep invoices, payments, reports and
// client summaries consistent.
//
//   subtotal = Σ (qty × price)
//   discount = fixed amount, clamped to subtotal
//   taxable  = subtotal − discount
//   tax      = taxable × taxRate%
//   total    = taxable + tax
const { Prisma } = require('@prisma/client');

function invoiceSubtotal(invoiceOrItems) {
  const items = invoiceOrItems.items || invoiceOrItems;
  return items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
}

function computeTotals(invoice, taxRate) {
  const subtotal = invoiceSubtotal(invoice);
  const discount = Math.min(Math.max(Number(invoice.discount || 0), 0), subtotal);
  const taxable = subtotal - discount;
  const tax = taxable * ((Number(taxRate) || 0) / 100);
  return { subtotal, discount, taxable, tax, total: taxable + tax };
}

// The taxed invoice total — the number printed on the invoice and PDF.
function invoiceTotal(invoice, taxRate) {
  return computeTotals(invoice, taxRate).total;
}

function paidSum(payments) {
  return (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
}

// Small tolerance used when comparing paid amounts against totals (floats).
const MONEY_EPSILON = 0.001;

// Serialize a Decimal exactly as a number so res.json() never drops precision.
function toNumber(value) {
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

module.exports = { invoiceSubtotal, computeTotals, invoiceTotal, paidSum, MONEY_EPSILON, toNumber };