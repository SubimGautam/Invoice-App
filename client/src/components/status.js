// Status vocabulary + derivation shared by StatusPill and any page that needs
// to label invoices. Kept component-free so fast-refresh rules stay happy.
//
// "Overdue" isn't a stored status — it's a sent/partially-paid invoice whose
// due date has passed. "Partially Paid" is derived from recorded payments vs
// the invoice total (both attached by the server).
import { isSettled } from '../lib/money';
export const STATUS_STYLES = {
  paid: { dot: '#006c49', text: '#006c49', bg: 'rgba(111,251,190,0.4)', label: 'Paid' },
  pending: { dot: '#684000', text: '#684000', bg: 'rgba(255,221,184,0.6)', label: 'Sent' },
  partiallyPaid: { dot: '#684000', text: '#684000', bg: 'rgba(255,234,180,0.85)', label: 'Partially Paid' },
  overdue: { dot: '#ba1a1a', text: '#ba1a1a', bg: 'rgba(255,218,214,0.4)', label: 'Overdue' },
  draft: { dot: '#777587', text: '#464555', bg: '#e2e7ff', label: 'Draft' },
  // Neutral/muted on purpose: a voided invoice isn't an error (that's `overdue`)
  // or a success, it's "this didn't happen". Deliberately distinct from `draft`'s
  // indigo so a cancelled invoice never reads as still-editable work in progress.
  void: { dot: '#777587', text: '#464555', bg: 'rgba(214,213,224,0.7)', label: 'Void' },
};

export function computeDisplayStatus(invoice) {
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.paid || 0);
  // `void` is checked FIRST and short-circuits. A voided invoice is excluded
  // from every total, so letting it fall through to the paid/overdue logic
  // would relabel a cancellation as "Paid" or "Overdue" purely because of
  // leftover payments or a past due date.
  if (invoice.status === 'void') return 'void';
  // isSettled compares in integer cents with a half-cent tolerance, replacing
  // an inline `paid >= total - 0.001`. That 0.001 was a float band too wide to
  // be meaningful and too tight to be a real cent boundary; a client who paid
  // 1.5 cents short could be labelled "Paid".
  if (invoice.status === 'paid' || (total > 0 && isSettled(paid, total))) return 'paid';
  if (invoice.status === 'draft') return 'draft';
  if (new Date(invoice.dueDate) < new Date()) return 'overdue';
  if (paid > 0) return 'partiallyPaid';
  return 'pending';
}

export function displayStatusLabel(status) {
  return STATUS_STYLES[status]?.label || status;
}