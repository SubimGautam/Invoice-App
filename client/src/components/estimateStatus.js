// Status vocabulary for estimates (quotes). Kept separate from status.js because
// an estimate has its own lifecycle — nothing here overlaps with the invoice
// statuses except 'draft' and the shared visual language, and the two sets
// evolve independently.
//
// Unlike invoices, an estimate's status is fully stored on the server: there is
// no "overdue" derivation because a quote expires rather than goes overdue, and
// the client's answer (accepted/declined) is the state that matters.
export const ESTIMATE_STYLES = {
  draft: { dot: '#777587', text: '#464555', bg: '#e2e7ff', label: 'Draft' },
  sent: { dot: '#684000', text: '#684000', bg: 'rgba(255,221,184,0.6)', label: 'Sent' },
  accepted: { dot: '#006c49', text: '#006c49', bg: 'rgba(111,251,190,0.4)', label: 'Accepted' },
  declined: { dot: '#ba1a1a', text: '#ba1a1a', bg: 'rgba(255,218,214,0.4)', label: 'Declined' },
  converted: { dot: '#4f46e5', text: '#3525cd', bg: 'rgba(224,222,255,0.9)', label: 'Converted' },
};

export function estimateStatusLabel(status) {
  return ESTIMATE_STYLES[status]?.label || status;
}

// A sent quote past its "valid until" date is no longer a live offer. Surfaced
// separately rather than overwriting the status, because "Sent" is still the
// true stored state — the expiry is a fact about the dates, not the workflow.
export function isExpired(estimate) {
  return new Date(estimate.validUntil) < new Date();
}

// Tabs for the estimates list, with live counts so the user can see where work
// is stuck without running a report.
export const ESTIMATE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'sent', label: 'Awaiting reply' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
  { key: 'converted', label: 'Converted' },
];
