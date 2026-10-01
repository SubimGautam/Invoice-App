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
// `Math.round` is safe here: the scaled value's float error is ~1e-10 absolute,
// so it can never sit near a 0.5 rounding boundary.
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
// so it drops in wherever the old inline reduce lived. The scaled products are
// summed at full precision and rounded ONCE at the end, which is what stops
// per-line rounding from accumulating drift.
export function itemsSubtotal(invoiceOrItems) {
  const items = Array.isArray(invoiceOrItems) ? invoiceOrItems : invoiceOrItems?.items || [];
  const sum = items.reduce((acc, item) => acc + toScaled(item?.quantity) * toScaled(item?.unitPrice), 0);
  return fromCents(roundHalfUpDiv(sum, LINE_DIVISOR));
}

// Full totals, matching the server's shape and ordering:
//   discount is clamped to [0, subtotal], and tax is applied to the DISCOUNTED
//   amount (taxable = subtotal − discount), not to the gross subtotal.
export function computeTotals(invoice, taxRate) {
  const subtotalCents = toCents(itemsSubtotal(invoice));
  const discountCents = Math.min(Math.max(toCents(invoice?.discount), 0), subtotalCents);
  const taxableCents = subtotalCents - discountCents;
  // taxCents = taxableCents × rateScaled / (SCALE_INT × 100)
  const taxCents = roundHalfUpDiv(taxableCents * toScaled(taxRate), SCALE_INT * 100);
  return {
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountCents),
    taxable: fromCents(taxableCents),
    tax: fromCents(taxCents),
    total: fromCents(taxableCents + taxCents),
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
