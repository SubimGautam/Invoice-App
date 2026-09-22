// Single source of truth for currency symbols and money formatting across the
// whole client so every page shows the SAME symbol for a workspace's currency.
export const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', NPR: 'Rs. ' };

export function symbolFor(currency) {
  return CURRENCY_SYMBOLS[currency] || (currency ? `${currency} ` : '$');
}

export function formatMoney(n, currency) {
  return `${symbolFor(currency)}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// Compact axis/label form (e.g. "$6.2k") — keeps tiny chart bars legible.
export function compactMoney(n, currency) {
  const s = symbolFor(currency);
  const abs = Math.abs(Number(n || 0));
  if (abs >= 1e6) return `${s}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${s}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
  return `${s}${Math.round(abs)}`;
}
