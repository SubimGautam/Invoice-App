import { ESTIMATE_STYLES } from './estimateStatus';

// The colored pill used to show an estimate's status in lists. Mirrors
// StatusPill but reads the estimate vocabulary (an estimate is never
// "Partially Paid" or "Overdue").
export default function EstimateStatusPill({ status }) {
  const s = ESTIMATE_STYLES[status] || ESTIMATE_STYLES.draft;
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
