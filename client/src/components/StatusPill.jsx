// Shared status display used by the invoice list (Dashboard), customer detail
// and anywhere else an invoice's status pill appears.
//
// "Overdue" isn't a stored status — it's a sent/partially-paid invoice whose
// due date has passed. "Partially Paid" is derived from recorded payments vs
// the invoice total (both attached by the server).
export const STATUS_STYLES = {
  paid: { dot: '#006c49', text: '#006c49', bg: 'rgba(111,251,190,0.4)', label: 'Paid' },
  pending: { dot: '#684000', text: '#684000', bg: 'rgba(255,221,184,0.6)', label: 'Sent' },
  partiallyPaid: { dot: '#684000', text: '#684000', bg: 'rgba(255,234,180,0.85)', label: 'Partially Paid' },
  overdue: { dot: '#ba1a1a', text: '#ba1a1a', bg: 'rgba(255,218,214,0.4)', label: 'Overdue' },
  draft: { dot: '#777587', text: '#464555', bg: '#e2e7ff', label: 'Draft' },
};

export function computeDisplayStatus(invoice) {
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.paid || 0);
  if (invoice.status === 'paid' || (total > 0 && paid >= total - 0.001)) return 'paid';
  if (invoice.status === 'draft') return 'draft';
  if (new Date(invoice.dueDate) < new Date()) return 'overdue';
  if (paid > 0) return 'partiallyPaid';
  return 'pending';
}

export function displayStatusLabel(status) {
  return STATUS_STYLES[status]?.label || status;
}

export function StatusPill({ status }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}