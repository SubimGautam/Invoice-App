// Shared money math for the whole API. Every money figure in the app is derived
// from line items + discount (there's no stored "total" column), so all money
// math lives in one place to keep invoices, payments, reports and client
// summaries consistent.
//
//   subtotal = Σ (qty × price)
//   discount = fixed amount, clamped to subtotal
//   taxable  = subtotal − discount
//   tax      = taxable × taxRate%
//   total    = taxable + tax
//
// THE ARITHMETIC IS EXACT DECIMAL, THE API IS STILL NUMBERS.
//
// The DB columns are already `Decimal` (Postgres NUMERIC), so a value read back
// is exact — but `Number(item.quantity) * Number(item.unitPrice)` throws that
// exactness away and accumulates in binary floating point. Concretely, before
// this change: 3×0.10 + 7×14.29 at 13% tax produced a tax figure of 13.0429
// where the exact answer is 13.04, and 200 line items of 0.07 summed to
// 14.000000000000037. The old `MONEY_EPSILON = 0.001` fudge could not have
// caught either: 0.001 is ~11 orders of magnitude larger than the error it
// would need to detect, so it silently tolerated drift instead of preventing
// it.
//
// So: every sum, product and percentage here runs in `Prisma.Decimal`, and each
// monetary boundary rounds to cents (2dp, half-up — the rounding a human would
// apply). The functions still return plain JS numbers, because ~60 call sites
// across the API compare them, subtract them and `res.json()` them; changing the
// return type would be a large, risky refactor for no accuracy gain. Two
// exactly-rounded cent values are safe to sum as numbers, so the contract
// holds.
//
// The genuinely fragile arithmetic (subtotal, tax, running totals over many
// invoices) is now exact. Anything that still does its own float math is a bug
// — route it through itemsSubtotal() instead.
const { Prisma } = require('@prisma/client');
const Decimal = Prisma.Decimal;

// Coerce anything (number, string, Decimal) to a Decimal. Prisma returns
// Decimal for `Decimal` columns, but Zod-parsed request bodies give plain
// numbers, and some call sites pass strings.
function toDecimal(value) {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined || value === '') return new Decimal(0);
  return new Decimal(value);
}

// Round to cents, half-up. This is the boundary where a computed figure becomes
// an amount of money a client is asked to pay.
function roundMoney(decimal) {
  return toDecimal(decimal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// ...and the same, as a plain number for the response/comparison contract.
const money = (decimal) => roundMoney(decimal).toNumber();

// Σ (qty × price) over line items, exact. Accepts an invoice (uses .items) or a
// bare items array. Centralising this is the point: there were seven separate
// float copies of this reduce across the routes, which is how they drift apart.
function itemsSubtotal(invoiceOrItems) {
  const items = Array.isArray(invoiceOrItems) ? invoiceOrItems : invoiceOrItems.items || [];
  return money(
    items.reduce(
      (sum, item) => sum.plus(toDecimal(item.quantity).mul(toDecimal(item.unitPrice))),
      new Decimal(0)
    )
  );
}

// Back-compat alias: the original name meant "the subtotal of the items".
function invoiceSubtotal(invoiceOrItems) {
  return itemsSubtotal(invoiceOrItems);
}

// One line item's extended amount, exact.
//
// This exists because the obvious inline expression is subtly wrong twice over:
//   Number(q) * Number(p)                      -> float drift
//   Math.round(that * 100) / 100               -> ALSO float, and rounds
//                                                1.005 down to 1.00 because
//                                                1.005 * 100 is 100.49999…
// Decimal multiplication plus a real toDecimalPlaces(2) fixes both, and the
// per-line amount is what a client reads on the PDF, so it must be right.
function lineAmount(item) {
  return money(toDecimal(item.quantity).mul(toDecimal(item.unitPrice)));
}

function computeTotals(invoice, taxRate) {
  const subtotal = toDecimal(itemsSubtotal(invoice));
  // Clamp: a discount can't be negative, and can't exceed the subtotal
  // (a negative taxable base would silently produce a negative invoice total).
  const discount = Decimal.min(Decimal.max(toDecimal(invoice.discount), new Decimal(0)), subtotal);
  const taxable = subtotal.minus(discount);
  const tax = taxable.mul(toDecimal(taxRate)).div(100);
  return {
    subtotal: money(subtotal),
    discount: money(discount),
    taxable: money(taxable),
    tax: money(tax),
    total: money(taxable.plus(tax)),
  };
}

// The taxed invoice total — the number printed on the invoice and PDF.
function invoiceTotal(invoice, taxRate) {
  return computeTotals(invoice, taxRate).total;
}

// Σ recorded payment amounts, exact. Refunds are negative amounts, so they
// correctly net down the total paid.
function paidSum(payments) {
  return money(
    (payments || []).reduce((sum, p) => sum.plus(toDecimal(p.amount)), new Decimal(0))
  );
}

// What's still owed on an invoice: total − paid, floored at zero.
function outstanding(invoice, taxRate) {
  const diff = toDecimal(invoiceTotal(invoice, taxRate)).minus(toDecimal(paidSum(invoice.payments)));
  return money(diff.lt(0) ? new Decimal(0) : diff);
}

// Half a cent: the smallest difference that can exist between two legitimately
// rounded cent amounts. Used to decide "is this invoice fully paid?" without the
// old 0.001 band, which was wide enough to hide real drift. Still exported
// under the old name because many call sites compare against it inline.
const MONEY_EPSILON = 0.005;

// "Is this invoice fully paid?" Both arguments are numbers or Decimals. Kept as
// an explicit helper so the comparison isn't re-implemented (and mis-tuned) at
// each of its call sites.
function isSettled(paid, total) {
  return toDecimal(paid).minus(toDecimal(total)).abs().lte(toDecimal(MONEY_EPSILON));
}

// Serialize a Decimal as a number so res.json() never emits a Decimal object.
function toNumber(value) {
  return value instanceof Decimal ? value.toNumber() : Number(value);
}

// Round an arbitrary value to 2dp as a number (for response payloads built from
// raw input rather than from computeTotals).
const moneyNumber = (value) => money(value);

module.exports = {
  Decimal,
  toDecimal,
  money,
  itemsSubtotal,
  invoiceSubtotal,
  lineAmount,
  computeTotals,
  invoiceTotal,
  paidSum,
  outstanding,
  isSettled,
  roundMoney,
  moneyNumber,
  MONEY_EPSILON,
  toNumber,
};
