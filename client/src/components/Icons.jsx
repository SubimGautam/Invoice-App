// Local icon set. The app previously loaded icons from short-lived Figma MCP
// asset URLs (https://www.figma.com/api/mcp/asset/...) which Figma revoked,
// so every icon silently disappeared (404). These inline SVGs are bundled
// with the client and can never vanish. Icons use currentColor by default so
// they inherit the surrounding text color; KPI icons carry their accent color.
//
// Usage: <ChevronRightIcon className="w-1.5 h-2 opacity-50" />

function makeIcon(paths, viewBox = '0 0 24 24', opts = {}) {
  const { stroke = 'currentColor', fill = 'none', strokeWidth = 2 } = opts;
  return function Icon({ className, style }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={style}
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

export const ChevronLeftIcon = makeIcon(<path d="m15 18-6-6 6-6" />);

export const ChevronRightIcon = makeIcon(<path d="m9 18 6-6-6-6" />);

export const ChevronDownIcon = makeIcon(<path d="m6 9 6 6 6-6" />);

/** Tiny caret pointing down (date/month pickers). */
export const CaretDownIcon = makeIcon(<path d="m6 9 6 6 6-6" />);

export const PlusIcon = makeIcon(
  <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>
);

export const SearchIcon = makeIcon(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>
);

export const BellIcon = makeIcon(
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>
);

export const HelpIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </>
);

export const ExportIcon = makeIcon(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </>
);

/** Total outstanding — wallet. */
export const OutstandingIcon = makeIcon(
  <>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </>,
  '0 0 24 24',
  { stroke: '#4f46e5' }
);

/** Small trending-up arrow (Live badge). */
export const UpArrowIcon = makeIcon(
  <>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </>
);

/** Paid this month — check circle. */
export const PaidIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>,
  '0 0 24 24',
  { stroke: '#0e7a41' }
);

/** Overdue — alarm clock. */
export const OverdueIcon = makeIcon(
  <>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2" />
    <path d="M5 3 2 6" />
    <path d="m22 6-3-3" />
    <path d="M6.38 18.7 4 21" />
    <path d="M17.64 18.67 20 21" />
  </>,
  '0 0 24 24',
  { stroke: '#ba1a1a' }
);

/** Drafts — file with lines. */
export const DraftsIcon = makeIcon(
  <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </>,
  '0 0 24 24',
  { stroke: '#3525cd' }
);

export const CalendarIcon = makeIcon(
  <>
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
  </>
);

export const FilterIcon = makeIcon(<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />);

/**
 * Vertical action dots (⋯). Uses a narrow viewBox so the dots stay visible
 * at the tiny w-1 h-3 size used in the invoice table.
 */
export const DotsIcon = makeIcon(
  <>
    <circle cx="2" cy="3" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="2" cy="8.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="2" cy="14" r="1.6" fill="currentColor" stroke="none" />
  </>,
  '0 0 4 16',
  { strokeWidth: 0 }
);

export const EditIcon = makeIcon(
  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
);

export const EyeIcon = makeIcon(
  <>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

/** Horizontal swap arrows (bulk actions). */
export const BatchArrowIcon = makeIcon(
  <>
    <path d="M8 3 4 7l4 4" />
    <path d="M4 7h16" />
    <path d="m16 21 4-4-4-4" />
    <path d="M20 17H4" />
  </>
);

/** Document with lines — estimates/quotes. */
export const DocumentIcon = makeIcon(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h5" />
  </>
);

/** Check in a circle — "accepted" / confirm. */
export const CheckCircleIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 4.5-5" />
  </>
);

/** X in a circle — "declined". */
export const XCircleIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15 9-6 6M9 9l6 6" />
  </>
);

/** Arrow turning into a document — "convert estimate to invoice". */
export const ConvertIcon = makeIcon(
  <>
    <path d="M16 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <path d="M10 17l5-5-5-5" />
    <path d="M15 12H3" />
  </>
);

/** Link/chain — copy the public quote link. */
export const LinkIcon = makeIcon(
  <>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </>
);