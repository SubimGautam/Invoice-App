// Shared money math for the whole API. Every money figure in the app is derived
// from line items + discount (there's no stored "total" column), so all money
// math lives in one place to keep invoices, payments, reports and client
// summaries consistent.
//
//   subtotal = Σ (qty × price)
//   discount = fixed amount, clamped to subtotal
//   taxable  = subtotal − discount
//   tax      = Σ (line taxable × that line's taxRate%)
//   total    = taxable + tax
//
// PER-ITEM TAX
//
// A line may carry its own tax rate (`InvoiceItem.taxRate`), which is how a
// mixed-rate invoice works — e.g. consulting at 13% VAT alongside a
// zero-rated book. A line with no rate falls back to the workspace
// `defaultTaxRate`. Because the rates differ per line, the invoice-level
// discount has to be allocated across lines (see `allocateProportional`) before
// each line is taxed, rather than deducted once from a single taxed base.
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

// Σ (qty × price) over line items. Accepts an invoice (uses .items) or a bare
// items array. Centralising this is the point: there were seven separate float
// copies of this reduce across the routes, which is how they drift apart.
//
// NOTE this sums each line's ROUNDED amount rather than rounding the sum. That
// matters for documents, not just arithmetic: the PDF prints one amount per
// line, and a client who adds those up must land on the subtotal shown beneath
// them. Rounding the sum instead would let three lines of 0.13 print as a
// subtotal of 0.38.
function itemsSubtotal(invoiceOrItems) {
  const items = Array.isArray(invoiceOrItems) ? invoiceOrItems : invoiceOrItems.items || [];
  return money(
    items.reduce((sum, item) => sum.plus(toDecimal(lineAmount(item))), new Decimal(0))
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

// The tax rate that applies to one line. A line may carry its own rate (for a
// product that is taxed differently from the workspace default); null/absent
// means "use the workspace default". This is why `taxRate` is a parameter here
// and not just captured once.
function lineTaxRate(item, defaultRate) {
  const own = item?.taxRate;
  if (own === null || own === undefined || own === '') return toDecimal(defaultRate);
  return toDecimal(own);
}

// Split `total` across `weights` in proportion to weight, so the parts sum to
// EXACTLY `total` — the largest-remainder method.
//
// Naive proportional splitting does not: divide a 0.01 discount across three
// equal lines and you get 0.0033 each, which rounds to 0.00 and loses the cent
// entirely. Flooring first and handing the leftover cents to the lines with the
// largest fractional parts keeps the invoice internally consistent, which
// matters because the PDF prints these per-line figures next to a total.
function allocateProportional(total, weights) {
  const sumWeights = weights.reduce((a, w) => a.plus(w), new Decimal(0));
  if (sumWeights.isZero() || total.isZero()) return weights.map(() => new Decimal(0));

  const raw = weights.map((w) => total.mul(w).div(sumWeights));
  // Floor at CENT granularity, not whole dollars. Flooring 0.00333 to 0 is right,
  // but `Decimal.floor()` would take it to the nearest whole *dollar* — and the
  // leftover then has to be handed out a cent at a time, or a 1-cent discount
  // across three lines becomes a 1-DOLLAR discount on one of them.
  const out = raw.map((r) => r.toDecimalPlaces(2, Decimal.ROUND_FLOOR));
  let leftover = total.minus(out.reduce((a, b) => a.plus(b), new Decimal(0)));

  // Largest fractional remainder first, so the cents land on the lines that
  // lost the most. Ties fall back to declaration order, which keeps the result
  // deterministic — important, since a re-render must not shuffle cents around.
  const order = raw
    .map((r, i) => ({ i, frac: r.minus(r.toDecimalPlaces(2, Decimal.ROUND_FLOOR)) }))
    .sort((a, b) => b.frac.cmp(a.frac) || a.i - b.i);

  const CENT = new Decimal('0.01');
  for (const { i } of order) {
    if (leftover.lt(CENT)) break;
    out[i] = out[i].plus(CENT);
    leftover = leftover.minus(CENT);
  }
  return out;
}

// Reconcile independently-rounded per-line taxes to the invoice's rounded tax
// total, moving whole cents onto the lines that were rounded least accurately.
//
// Without this, Σ round2(tax_i) can differ from round2(Σ tax_i) by a cent, and
// an invoice whose printed tax lines don't add up to its printed tax total is a
// support call. Distributing the rounding — rather than rounding once at the end
// and showing per-line figures that disagree — keeps the document self-
// consistent.
function reconcileToTotal(exacts, rounded, target) {
  const out = rounded.map((r) => r);
  let diff = target.minus(out.reduce((a, b) => a.plus(b), new Decimal(0)));
  if (diff.isZero()) return out;

  // Most under-rounded first when we owe cents; most over-rounded first when we
  // need to take them back. Sorting on the rounding error, not on index, puts
  // the adjustment where it distorts the line least.
  const byAscendingError = (x, y) => exacts[x].minus(rounded[x]).cmp(exacts[y].minus(rounded[y])) || x - y;
  const order = diff.isPositive()
    ? exacts.map((_, i) => i).sort(byAscendingError)          // rounded down most
    : exacts.map((_, i) => i).sort((x, y) => -byAscendingError(x, y));

  // Whole cents, never whole currency units — diff is at most a few cents.
  const CENT = new Decimal('0.01');
  for (const i of order) {
    if (diff.abs().lt(CENT)) break;
    const step = diff.isPositive() ? CENT : CENT.neg();
    if (out[i].plus(step).lt(0)) continue; // never make a tax line negative
    out[i] = out[i].plus(step);
    diff = diff.minus(step);
  }
  return out;
}

// Full totals, with PER-ITEM tax rates.
//
// How a single invoice-level discount interacts with differing line rates: the
// discount is allocated across lines in proportion to each line's amount, then
// each line is taxed on its OWN discounted amount. That is standard VAT
// accounting — a discount reduces the taxable base, it is not subtracted after
// tax.
//
// Two invariants this function must never break, because breaking either would
// silently restate money already owed to clients:
//
//  1. When every line carries the same rate (or none at all), the result is
//     bit-identical to the old single-rate math. Since tax is summed exactly and
//     rounded ONCE, and Σ allocated discounts == the discount exactly, that
//     holds by construction rather than by luck.
//  2. The per-line figures sum exactly to the invoice totals, so the PDF and the
//     UI cannot disagree with each other.
function computeTotals(invoice, taxRate) {
  const items = Array.isArray(invoice) ? invoice : invoice?.items || [];
  if (!items.length) {
    return { subtotal: 0, discount: 0, taxable: 0, tax: 0, total: 0, taxByRate: [] };
  }

  // Amounts are per-line ROUNDED (that is the figure printed on the PDF), so
  // everything downstream is in whole cents and the printed lines reconcile to
  // the printed subtotal.
  const amounts = items.map((it) => toDecimal(lineAmount(it)));
  const subtotal = amounts.reduce((a, b) => a.plus(b), new Decimal(0));

  // Clamp: a discount can't be negative, and can't exceed the subtotal (a
  // negative taxable base would silently produce a negative invoice total).
  // Quantised to cents BEFORE allocating, so the leftover cents to distribute are
  // always whole cents — allocating an unrounded discount leaves a sub-cent
  // remainder that can't be handed out, and the cent disappears.
  const discount = Decimal.min(
    Decimal.max(roundMoney(invoice.discount), new Decimal(0)),
    subtotal
  );
  const lineDiscounts = allocateProportional(discount, amounts);
  const lineTaxables = amounts.map((a, i) => a.minus(lineDiscounts[i]));

  const rates = items.map((it) => lineTaxRate(it, taxRate));
  const exactTaxes = lineTaxables.map((t, i) => t.mul(rates[i]).div(100));
  const tax = money(exactTaxes.reduce((a, b) => a.plus(b), new Decimal(0)));
  const lineTaxes = reconcileToTotal(
    exactTaxes,
    exactTaxes.map(roundMoney),
    toDecimal(tax)
  );

  const taxable = subtotal.minus(discount);

  // Per-rate tax breakdown, for VAT reporting and the PDF's tax summary. Keyed
  // by the rate string so 13 and 13.00 collapse together.
  const taxByRateMap = new Map();
  lineTaxes.forEach((t, i) => {
    const key = rates[i].toString();
    taxByRateMap.set(key, (taxByRateMap.get(key) || new Decimal(0)).plus(t));
  });
  const taxByRate = [...taxByRateMap.entries()]
    .map(([rate, amount]) => ({ rate: Number(rate), amount: money(amount) }))
    .sort((a, b) => a.rate - b.rate);

  return {
    subtotal: money(subtotal),
    discount: money(discount),
    taxable: money(taxable),
    tax,
    total: money(taxable.plus(tax)),
    // These two are for display only; the totals above are authoritative.
    taxByRate,
    lines: items.map((item, i) => ({
      amount: money(amounts[i]),
      discount: money(lineDiscounts[i]),
      taxable: money(lineTaxables[i]),
      taxRate: Number(rates[i]),
      tax: money(lineTaxes[i]),
    })),
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

// Attach the full computed breakdown to an invoice for the wire.
//
// `total` alone is not enough once line items can carry different tax rates:
// the client and the PDF both need the per-line amount and tax, and a caller
// reconciling a payment against `total` has no way to see where the tax came
// from. Centralised here so every response that renders money uses the same
// figures in the same shape.
//
// `paid` and `remaining` are here for the same reason. The public pay view
// already returned a balance, the authenticated invoice view did not, so the
// client re-derived `total - paid` itself — two implementations of one figure,
// free to drift. Deriving it once, here, means a customer looking at the pay
// link and a staff member looking at the invoice see the same number.
function withTotals(invoice, taxRate) {
  const t = computeTotals(invoice, taxRate);
  const items = invoice.items || [];
  // Prefer summing the payments themselves — exact, and correct once refunds
  // are in play. Fall back to an already-computed `paid` (list queries) when
  // the payments weren't loaded, so we never report a false zero on a paid
  // invoice just because its payments weren't in the `include`.
  let paid;
  if (invoice.payments) {
    paid = paidSum(invoice.payments);
  } else if (invoice.paid != null) {
    paid = money(invoice.paid);
  } else {
    paid = 0;
  }
  const diff = toDecimal(t.total).minus(toDecimal(paid));
  // Floor at zero: overpayment is rejected, but a refund issued against a
  // since-edited invoice can still overshoot. Nobody is owed a negative balance.
  const remaining = money(diff.lt(0) ? new Decimal(0) : diff);
  return {
    ...invoice,
    items: items.map((item, i) => ({
      ...item,
      amount: t.lines[i] ? t.lines[i].amount : lineAmount(item),
      taxAmount: t.lines[i] ? t.lines[i].tax : 0,
      // The rate actually applied. The stored `taxRate` stays null when the line
      // inherits the workspace default, so a renderer that used it directly
      // would show "no tax" on a line that is in fact taxed.
      effectiveTaxRate: t.lines[i] ? t.lines[i].taxRate : Number(toNumber(toDecimal(taxRate))),
    })),
    subtotal: t.subtotal,
    discount: t.discount,
    taxable: t.taxable,
    tax: t.tax,
    total: t.total,
    taxBreakdown: t.taxByRate,
    paid,
    remaining,
  };
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
  lineTaxRate,
  allocateProportional,
  computeTotals,
  invoiceTotal,
  paidSum,
  outstanding,
  isSettled,
  roundMoney,
  withTotals,
  moneyNumber,
  MONEY_EPSILON,
  toNumber,
};
