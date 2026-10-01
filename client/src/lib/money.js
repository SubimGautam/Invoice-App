// Client-side money math, mirroring server/lib/money.js.
//
// WHY THIS EXISTS
//
// The invoice form shows a running total as the user types, and the detail
// pages re-derive line amounts for display. Both used to do it in floating
// point, duplicated across ~11 call sites, so the total the user typed towards
// could disagree with the total the server computed from the same inputs. That
// disagreement was real, not theoretical: server-side float math produced a tax
// figure of 13.0429 where the exact answer is 13.04, and 200 lines of 0.07
// summed to 14.000000000000037.
//
// HOW IT'S EXACT
//
// Everything is done in scaled INTEGER arithmetic with a single rounding step at
// the end. `SCALE = 1e6` means "six decimal places", so a value's scaled integer
// is exact for any money or quantity with up to 6dp — far beyond what an invoice
// ever has. A line amount is then
//
//   cents = roundHalfUpDiv( qScaled × pScaled , 1e10 )
//
// because qScaled × pScaled carries a factor of 1e12 (two scaled values
// multiplied), and dividing by 1e10 leaves cents. There is no float arithmetic
// anywhere in the chain, so:
//
//   3 × 0.1          = 0.30   (floats give 0.30000000000000004)
//   200 × 0.07       = 14.00  (floats give 14.000000000000037)
//   1 × 1.005        = 1.01   (Math.round(x*100)/100 gives 1.00)
//
// The rounding rule is half-up, matching the server's
// `toDecimalPlaces(2, ROUND_HALF_UP)` in Prisma.Decimal, so a cent never lands
// differently on the two sides of the wire.
//
// PRECISION CONTRACT
//
// This module is exact for any input with up to 6 decimal places, and the server
// is exact for any decimal input at all. That gap is deliberate and bounded:
// `toScaled` rounds to 1e-6, so a quantity like 11.947734429163008 would be read
// here as 11.947734. A line amount is a product of two such values, so the worst
// case is a couple of cents on a figure that requires a quantity more precise
// than a billionth to occur.
//
// It is unreachable for real invoicing: money is 2dp by definition, and a
// quantity is an integer or a small fraction (hours, kg, items). The
// money-parity test fuzzes both implementations over that realistic envelope —
// money to 2dp, quantities to 4dp — and asserts zero divergence, so the
// guarantee is pinned rather than assumed. Raising this to arbitrary precision
// would need BigInt-backed decimals and would buy nothing reachable.

// Decimal places the scaled-integer arithmetic carries.
const SCALE = 1e6;
const SCALE_INT = 1_000_000;

// Half-up rounding to an integer, applied to a non-negative scaled integer
// divided by a divisor. Done with integer arithmetic only, so a tie rounds up
// deterministically instead of depending on binary representation.
function roundHalfUpDiv(numerator, divisor) {
  // floor((2n + d) / 2d) === round-half-up(n/d) for n >= 0
  return Math.floor((2 * numerator + divisor) / (2 * divisor));
}

// Any numeric-ish value -> integer in units of 1e-6.
//
// `Math.round` is safe rather than merely convenient: the float error in
// `n * SCALE` is ~1e-10 absolute across the range money reaches (up to ~1e9
// scaled), which is nine orders of magnitude below the 0.5 boundary it would
// have to land on to change an answer. The only real limit is the 6dp one
// documented above — this rounds, it does not approximate a badly.
function toScaled(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * SCALE);
}

// Dollars -> cents is x100, and scaled is x1e6, so the divisor is 1e4.
// Integer division throughout: dividing a large integer by 1e4 in floating point
// is itself lossy, so it goes through roundHalfUpDiv rather than `/ 1e4`.
const DOLLARS_TO_CENTS_DIVISOR = 1e4;
export function toCents(value) {
  const sign = Number(value) < 0 ? -1 : 1;
  return sign * roundHalfUpDiv(Math.abs(toScaled(value)), DOLLARS_TO_CENTS_DIVISOR);
}

// Integer cents -> a number with at most 2dp.
export function fromCents(cents) {
  return cents / 100;
}

// Normalise an arbitrary value (e.g. a `total` the server attached) to a plain
// 2dp number, so client-rendered money always matches the wire format.
export function moneyNumber(value) {
  return fromCents(toCents(value));
}

// One line item's extended amount, exact.
// SCALE_INT^2 / (SCALE_INT * 100) === 1e10 is the divisor that lands the scaled
// product in cents.
const LINE_DIVISOR = 1e10;
export function lineAmount(item) {
  const cents = roundHalfUpDiv(toScaled(item?.quantity) * toScaled(item?.unitPrice), LINE_DIVISOR);
  return fromCents(cents);
}

// Σ (qty × price) over line items, exact. Accepts an invoice or a bare array,
// so it drops in wherever the old inline reduce lived.
//
// This sums each line's ROUNDED amount rather than rounding the sum, matching
// server/lib/money.js. That is not cosmetic: the PDF prints one amount per line,
// and a client who adds those up has to land on the subtotal printed beneath
// them. Three lines of 0.13 must subtotal to 0.39, not 0.38.
export function itemsSubtotal(invoiceOrItems) {
  const items = Array.isArray(invoiceOrItems) ? invoiceOrItems : invoiceOrItems?.items || [];
  return fromCents(items.reduce((acc, item) => acc + toCents(lineAmount(item)), 0));
}

// The tax rate that applies to one line: its own rate if it has one, else the
// workspace default. Mirrors `lineTaxRate` in server/lib/money.js.
export function lineTaxRate(item, defaultRate) {
  const own = item?.taxRate;
  if (own === null || own === undefined || own === '') return toScaled(defaultRate);
  return toScaled(own);
}

// Split `totalCents` across `weightsCents` in proportion, so the parts sum to
// EXACTLY totalCents — the largest-remainder method, as on the server.
//
// Flooring alone does not work: a 1-cent discount split three ways is 0.0033
// each, which floors to zero and loses the cent. Flooring first and handing the
// leftover cents to the largest fractional parts keeps the invoice internally
// consistent, which matters because these per-line figures get printed.
//
// Kept in integer cents throughout: `total * weight` and `sumWeights` share a
// common scale, so the quotient and the remainder are both exact integers and no
// floating point enters the split.
function allocateProportionalCents(totalCents, weightsCents) {
  const sumWeights = weightsCents.reduce((a, b) => a + b, 0);
  if (sumWeights === 0 || totalCents === 0) return weightsCents.map(() => 0);

  const out = weightsCents.map((w) => Math.floor((totalCents * w) / sumWeights));
  let leftover = totalCents - out.reduce((a, b) => a + b, 0);

  // Largest fractional remainder first; ties fall back to declaration order so
  // a re-render cannot shuffle cents between lines.
  const order = weightsCents
    .map((w, i) => ({ i, rem: (totalCents * w) % sumWeights }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);

  for (const { i } of order) {
    if (leftover <= 0) break;
    out[i] += 1;
    leftover -= 1;
  }
  return out;
}

// Reconcile independently-rounded per-line taxes to the invoice's rounded tax
// total, moving whole cents onto the lines that were rounded least accurately.
// Without this, Σ round2(tax_i) can differ from round2(Σ tax_i) by a cent and an
// invoice's printed tax lines won't add up to its printed tax total.
function reconcileTaxes(exactScaled, roundedCents, targetCents) {
  const out = roundedCents.slice();
  let diff = targetCents - out.reduce((a, b) => a + b, 0);
  if (diff === 0) return out;

  // Rounding error per line, in scaled units so it is exact: how far this line's
  // independently-rounded tax sits from the true figure.
  const error = (i) => exactScaled[i] - roundedCents[i] * 10000;

  // Most under-rounded first when we owe cents; most over-rounded first when we
  // take them back. Deliberately structured to mirror the server's comparator
  // *including its tie-break*, because when several lines round equally the
  // choice is arbitrary but must still be identical on both sides — otherwise a
  // line shows 0.01 tax in the form and 0.00 on the saved invoice.
  const byAscendingError = (x, y) => {
    const d = error(x) - error(y);
    return d !== 0 ? d : x - y;
  };
  const order = exactScaled
    .map((_, i) => i)
    .sort(diff > 0 ? byAscendingError : (x, y) => -byAscendingError(x, y));

  for (const i of order) {
    if (diff === 0) break;
    const step = diff > 0 ? 1 : -1;
    if (out[i] + step < 0) continue; // never make a tax line negative
    out[i] += step;
    diff -= step;
  }
  return out;
}

// Full totals with PER-ITEM tax rates, matching the server exactly.
//
// The single invoice-level discount is allocated across lines in proportion to
// each line's amount, and each line is then taxed on its OWN discounted amount —
// so a discount reduces the taxable base rather than being subtracted after tax.
// When every line uses the same rate this is arithmetically identical to taxing
// one combined base, which is what keeps existing invoices' totals unchanged.
export function computeTotals(invoice, taxRate) {
  const items = Array.isArray(invoice) ? invoice : invoice?.items || [];
  if (!items.length) {
    return { subtotal: 0, discount: 0, taxable: 0, tax: 0, total: 0, taxByRate: [], lines: [] };
  }

  const amountCents = items.map((it) => toCents(lineAmount(it)));
  const subtotalCents = amountCents.reduce((a, b) => a + b, 0);

  // Clamped to [0, subtotal] — a discount can't be negative, and exceeding the
  // subtotal would silently produce a negative invoice total.
  const discountCents = Math.min(Math.max(toCents(invoice?.discount), 0), subtotalCents);
  const lineDiscountCents = allocateProportionalCents(discountCents, amountCents);
  const lineTaxableCents = amountCents.map((a, i) => a - lineDiscountCents[i]);

  const rateScaled = items.map((it) => lineTaxRate(it, taxRate));
  // Everything below works in SCALED DOLLARS (1e-6), the same unit the server
  // uses, so the two implementations' rounding decisions are directly
  // comparable. From here on a cent is 10000 scaled units — mixing cents and
  // scaled units is how the two sides silently disagreed about which line
  // absorbs a rounding cent.
  const CENTS_TO_SCALED = 10000;
  const exactTaxScaled = lineTaxableCents.map(
    (c, i) => (c * CENTS_TO_SCALED * rateScaled[i]) / SCALE_INT / 100
  );
  // Sum at full precision and round ONCE, so a single-rate invoice lands on
  // exactly the same cent as before per-line rates existed.
  const taxCents = roundHalfUpDiv(exactTaxScaled.reduce((a, b) => a + b, 0), CENTS_TO_SCALED);
  const lineTaxCents = reconcileTaxes(
    exactTaxScaled,
    exactTaxScaled.map((v) => roundHalfUpDiv(v, CENTS_TO_SCALED)),
    taxCents
  );

  const taxableCents = subtotalCents - discountCents;

  // Per-rate breakdown for the tax summary, keyed so 13 and 13.00 collapse.
  const byRate = new Map();
  lineTaxCents.forEach((c, i) => {
    const key = String(rateScaled[i] / SCALE_INT);
    byRate.set(key, (byRate.get(key) || 0) + c);
  });

  return {
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountCents),
    taxable: fromCents(taxableCents),
    tax: fromCents(taxCents),
    total: fromCents(taxableCents + taxCents),
    taxByRate: [...byRate.entries()]
      .map(([rate, cents]) => ({ rate: Number(rate), amount: fromCents(cents) }))
      .sort((a, b) => a.rate - b.rate),
    lines: items.map((item, i) => ({
      amount: fromCents(amountCents[i]),
      discount: fromCents(lineDiscountCents[i]),
      taxable: fromCents(lineTaxableCents[i]),
      taxRate: rateScaled[i] / SCALE_INT,
      tax: fromCents(lineTaxCents[i]),
    })),
  };
}

export const invoiceTotal = (invoice, taxRate) => computeTotals(invoice, taxRate).total;

// Σ recorded payments, exact. Refunds are negative, so they net down.
export function paidSum(payments) {
  return fromCents((payments || []).reduce((sum, p) => sum + toCents(p.amount), 0));
}

// What's still owed, floored at zero.
export function outstanding(invoice, taxRate) {
  const diff = toCents(invoiceTotal(invoice, taxRate)) - toCents(paidSum(invoice.payments));
  return fromCents(diff < 0 ? 0 : diff);
}

// Half a cent, expressed in scaled units (0.005 × 1e6 = 5000) so the
// comparison stays in integer space.
const HALF_CENT_SCALED = 5_000;
export const MONEY_EPSILON = 0.005;

// "Is this invoice fully paid?" — the exact counterpart of the server's
// `Decimal.isSettled`, which compares with an inclusive half-cent tolerance.
// Comparing in scaled units (rather than rounding both sides to whole cents
// first) is what keeps this in step with the server: rounding first would call a
// 1-cent overpayment "settled", while the server correctly does not.
export function isSettled(paid, total) {
  return Math.abs(toScaled(paid) - toScaled(total)) <= HALF_CENT_SCALED;
}
