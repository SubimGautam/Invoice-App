import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { formatMoney, compactMoney } from '../lib/currency';
import StatusPill from '../components/StatusPill';
import { computeDisplayStatus, displayStatusLabel } from '../components/status';

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CaretDownIcon,
  PlusIcon,
  SearchIcon,
  ExportIcon,
  OutstandingIcon,
  UpArrowIcon,
  PaidIcon,
  OverdueIcon,
  DraftsIcon,
  CalendarIcon,
  FilterIcon,
  DotsIcon,
  EditIcon,
  EyeIcon,
  BatchArrowIcon,
} from '../components/Icons';

// Fallback when the server didn't attach a total (shouldn't happen — the list
// endpoint computes real totals, but this keeps the render safe).
function computeTotal(invoice) {
  return invoice.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function Avatar({ name, status }) {
  const bg = status === 'overdue' ? 'rgba(255,218,214,0.5)' : status === 'pending' ? '#eaedff' : '#e2e7ff';
  const color = status === 'overdue' ? '#ba1a1a' : '#131b2e';
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
      <span className="text-[13px] font-semibold tracking-[-0.325px]" style={{ color }}>
        {initials(name)}
      </span>
    </div>
  );
}

// --- Settlement Timeline chart -------------------------------------------------
// Pure-SVG grouped bar chart: "Invoiced" (value billed that month) vs
// "Collected" (payments received that month). No chart library — keeps the
// bundle small and the visuals matched to the app's design.
const INDIGO = '#4f46e5';
const GREEN = '#0e7a41';

function niceCeil(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function SettlementChart({ data, currency = 'NPR' }) {
  if (!data || data.length === 0) {
    return <div className="h-28 flex items-center justify-center text-xs text-[#9694a8]">Loading chart…</div>;
  }

  const W = 640;
  const H = 184;
  const padL = 54;
  const padB = 30;
  const padT = 10;
  const plotW = W - padL - 10;
  const plotH = H - padB - padT;

  const maxVal = niceCeil(Math.max(1, ...data.map((m) => Math.max(m.issuedSum, m.collectedSum))));
  const groupW = plotW / data.length;
  const barW = Math.min(34, groupW * 0.34);
  const yFor = (v) => padT + plotH * (1 - v / maxVal);
  const hFor = (v) => Math.max(0, (v / maxVal) * plotH);

  const yTicks = [0, maxVal / 2, maxVal];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full aspect-[640/184]" role="img" aria-label="Invoiced vs collected per month">
      {/* Horizontal gridlines + y labels */}
      {yTicks.map((t) => {
        const y = yFor(t);
        return (
          <g key={t}>
            <line x1={padL} x2={W - 8} y1={y} y2={y} stroke="#e2e7ff" strokeWidth={1} />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={11} fill="#9694a8" fontFamily="ui-monospace, monospace">
              {compactMoney(t, currency)}
            </text>
          </g>
        );
      })}

      {/* Bars: invoiced (indigo) left, collected (green) right, per month */}
      {data.map((m, i) => {
        const cx = padL + groupW * i + groupW / 2;
        return (
          <g key={m.key}>
            <rect
              x={cx - barW - 2}
              y={yFor(m.issuedSum)}
              width={barW}
              height={hFor(m.issuedSum)}
              rx={3}
              fill={INDIGO}
              opacity={m.issuedSum > 0 ? 1 : 0.15}
            >
              <title>{`${m.label} ${m.year} — Invoiced: ${m.issuedCount} invoice${m.issuedCount === 1 ? '' : 's'}, ${formatMoney(m.issuedSum, currency)}`}</title>
            </rect>
            <rect
              x={cx + 2}
              y={yFor(m.collectedSum)}
              width={barW}
              height={hFor(m.collectedSum)}
              rx={3}
              fill={GREEN}
              opacity={m.collectedSum > 0 ? 1 : 0.15}
            >
              <title>{`${m.label} ${m.year} — Collected: ${m.collectedCount} payment${m.collectedCount === 1 ? '' : 's'}, ${formatMoney(m.collectedSum, currency)}`}</title>
            </rect>
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={12} fill="#464555">
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function KPICard({ label, value, valueColor, icon, iconBg, footnote, badge, badgeColor, badgeBg }) {
  return (
    <div className="relative flex-1 min-w-[200px] bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-6 overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555] mb-1">{label}</p>
          <p className="text-2xl font-mono font-bold tracking-[-0.7px]" style={{ color: valueColor || '#131b2e' }}>
            {value}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
          {icon}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#464555]">{footnote}</p>
        <span
          className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full text-right"
          style={{ color: badgeColor, backgroundColor: badgeBg }}
        >
          {badge}
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#dae2fd]" />
    </div>
  );
}

const DEFAULT_STATS = {
  counts: { all: 0, draft: 0, pending: 0, partiallyPaid: 0, paid: 0, overdue: 0 },
  sums: { totalOutstanding: 0, paidThisMonth: 0, overdueTotal: 0, draftsTotal: 0 },
};

export default function Dashboard() {
  const { canWrite, canManage } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [timeline, setTimeline] = useState([]);
  const [currency, setCurrency] = useState('NPR');
  const [exporting, setExporting] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);
  const [menuId, setMenuId] = useState(null);
  const location = useLocation();

  // Cross-page success notices (e.g. "Invoice saved as a draft") arrive via
  // router state when navigating back to the dashboard. replaceState clears it
  // so a refresh or back-button press doesn't re-show the banner. The timer
  // defers the state update so it stays outside the effect's synchronous body.
  useEffect(() => {
    if (location.state?.notice) {
      const t = setTimeout(() => {
        setNotice(location.state.notice);
        window.history.replaceState({}, '');
      }, 0);
      return () => clearTimeout(t);
    }
  }, [location.state]);

  // Real counts + dollar totals across the WHOLE account — independent of pagination/filter.
  useEffect(() => {
    loadStats();
    api.getTimeline().then((d) => setTimeline(d.months || [])).catch(() => {});
    // The workspace currency drives every money label on this page (KPI cards,
    // invoice table, chart axis/tooltips) so the symbol is consistent app-wide.
    api.getSettings().then((s) => setCurrency(s.currency || 'NPR')).catch(() => {});
  }, []);

  async function loadStats() {
    try {
      const data = await api.getInvoiceStats();
      setStats(data);
    } catch {
      // Non-fatal — KPI cards just show zeros if this fails; the invoice list still works.
    }
  }

  // Search now costs a round trip, so debounce it into its own value. Typing
  // "Acme" shouldn't fire six identical requests.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Re-fetch whenever the page, the filter, or the debounced search changes —
  // all three are server-side now, so none of them can be resolved locally.
  useEffect(() => {
    loadInvoices();
  }, [page, activeFilter, debouncedSearch]);

  async function loadInvoices() {
    setLoading(true);
    setError('');
    try {
      const statusParam =
        activeFilter === 'all'
          ? undefined
          : activeFilter === 'partiallyPaid'
            ? 'partially_paid'
            : activeFilter;
      const data = await api.getInvoices(page, 5, statusParam, debouncedSearch || undefined);
      setInvoices(data.invoices);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Typing a new search must land on page 1 of the NEW result set — otherwise
  // you're on page 7 of a 2-page filtered list and it looks like the search
  // found nothing.
  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  // Clicking a tab changes the filter AND resets to page 1, so you don't land on
  // a nonexistent page of a much smaller filtered result set.
  function handleFilterChange(key) {
    setActiveFilter(key);
    setPage(1);
  }

  // Real CSV export of every invoice in the account (walks all pages).
  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      let all = [];
      let page = 1;
      let totalPages = 1;
      do {
        const data = await api.getInvoices(page, 50);
        all = all.concat(data.invoices);
        totalPages = data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      const esc = (v) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = all.map((inv) => {
        const total = Number(inv.total || 0);
        const paid = Number(inv.paid || 0);
        const ds = computeDisplayStatus(inv);
        return [
          inv.invoiceNumber,
          inv.client.name,
          inv.client.email || '',
          formatDate(inv.issueDate),
          formatDate(inv.dueDate),
          displayStatusLabel(ds),
          total.toFixed(2),
          paid.toFixed(2),
          Math.max(0, total - paid).toFixed(2),
        ]
          .map(esc)
          .join(',');
      });
      const csv = [
        'Invoice #,Client,Email,Issue Date,Due Date,Status,Total,Paid,Remaining',
        ...rows,
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billflow-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  // "Mark as Paid" shortcut from the row menu — the server backfills a payment
  // record so the payment history stays complete.
  async function handleMarkPaid(inv) {
    setMenuId(null);
    if (!window.confirm(`Mark invoice ${inv.invoiceNumber} as paid? A payment record will be added automatically.`)) return;
    try {
      await api.updateInvoiceStatus(inv.id, 'paid');
      await Promise.all([loadStats(), loadInvoices()]);
    } catch (err) {
      setError(err.message);
    }
  }

  // "Cancel" is one action with two very different outcomes, chosen by whether
  // the invoice has financial history:
  //   - never-sent draft, no payments  -> really deleted (it never happened)
  //   - anything sent/paid/part-paid  -> voided: the row, its line items, its
  //     payments and its audit trail all stay, but it leaves every total
  // The void path asks for a reason because the whole point of voiding instead
  // of deleting is that the explanation is still readable months later.
  async function handleDeleteInvoice(inv) {
    setMenuId(null);
    const isTrashable = inv.status === 'draft' && !(inv.paid > 0);

    if (isTrashable) {
      if (!window.confirm(`Delete draft ${inv.invoiceNumber}? This can't be undone.`)) return;
      try {
        await api.deleteInvoice(inv.id);
        setNotice(`Draft ${inv.invoiceNumber} deleted.`);
        await Promise.all([loadStats(), loadInvoices()]);
      } catch (err) {
        setError(err.message);
      }
      return;
    }

    const label = inv.invoiceNumber;
    if (!window.confirm(
      `Void ${label}?\n\n` +
      `The invoice is kept for your records and drops out of your totals, but it ` +
      `can no longer be edited or paid.`
    )) return;

    const reason = window.prompt('Why are you voiding this invoice? (required)', '');
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setError('Give a short reason so the record still makes sense later.');
      return;
    }

    try {
      const res = await api.voidInvoice(inv.id, reason.trim());
      setNotice(res.note || `Invoice ${label} voided.`);
      await Promise.all([loadStats(), loadInvoices()]);
    } catch (err) {
      setError(err.message);
    }
  }

  // Emails a reminder to every overdue client in one click. The server picks the
  // invoices, so the client just reports the result.
  async function handleBatchReminders() {
    setRunningBatch(true);
    setError('');
    setNotice('');
    try {
      const result = await api.batchReminders();
      setNotice(
        result.simulated
          ? `${result.sent} reminder${result.sent === 1 ? '' : 's'} simulated — SMTP isn't configured, so delivery is logged instead of sent.`
          : `${result.sent} reminder${result.sent === 1 ? '' : 's'} emailed to overdue clients.`
      );
      await loadStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningBatch(false);
    }
  }

  const invoicesWithStatus = useMemo(
    () =>
      invoices.map((inv) => ({
        ...inv,
        displayStatus: computeDisplayStatus(inv),
        total: Number(inv.total ?? computeTotal(inv)),
      })),
    [invoices]
  );

  // BOTH the status filter and the search are resolved server-side in
  // loadInvoices, so the server's page is already the answer — filtering it
  // again here would silently drop matches (the old bug: search only ever saw
  // the 5 rows on the current page, so anything else read as "no results").

  const tabs = [
    { key: 'all', label: 'All Invoices' },
    { key: 'draft', label: 'Draft' },
    { key: 'pending', label: 'Sent' },
    { key: 'partiallyPaid', label: 'Partially Paid' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'void', label: 'Void' },
  ];

  return (
    <DashboardLayout>
      <div className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Workspace</span>
              <ChevronRightIcon className="w-1.5 h-2 opacity-50" />
              <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">Dashboard</span>
            </div>
            <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1">Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.05)] text-sm font-semibold text-[#131b2e] px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <ExportIcon className="w-3 h-3" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <Link
              to="/invoices/new"
              className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors"
            >
              <PlusIcon className="w-2.5 h-2.5" />
              New Invoice
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            {error}
            <button onClick={loadInvoices} className="font-semibold underline">Retry</button>
          </div>
        )}

        {notice && (
          <div className="mt-4 bg-[#f2f3ff] text-[#3525cd] text-sm px-4 py-3 rounded-xl">{notice}</div>
        )}

        {loading ? (
          <div className="mt-6 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-10 text-center text-sm text-[#464555]">
            Loading invoices...
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 md:gap-6 mt-6">
              <KPICard
                label="Total Outstanding"
                value={formatMoney(stats.sums.totalOutstanding, currency)}
                icon={<OutstandingIcon className="w-[18px] h-[18px]" />}
                iconBg="#eaedff"
                footnote={`${stats.counts.pending + stats.counts.partiallyPaid} invoices pending`}
                badge={<span className="flex items-center gap-1"><UpArrowIcon className="w-2.5 h-1.5" />Live</span>}
                badgeColor="#006c49"
                badgeBg="#f2f3ff"
              />
              <KPICard
                label="Paid This Month"
                value={formatMoney(stats.sums.paidThisMonth, currency)}
                icon={<PaidIcon className="w-[18px] h-[18px]" />}
                iconBg="rgba(111,251,190,0.3)"
                footnote={`${stats.counts.paid} settled invoices`}
                badge="On schedule"
                badgeColor="#006c49"
                badgeBg="#f2f3ff"
              />
              <KPICard
                label="Overdue"
                value={formatMoney(stats.sums.overdueTotal, currency)}
                valueColor="#ba1a1a"
                icon={<OverdueIcon className="w-[18px] h-[18px]" />}
                iconBg="rgba(255,218,214,0.4)"
                footnote={`${stats.counts.overdue} delayed client payments`}
                badge={stats.counts.overdue > 0 ? 'Requires action' : 'All clear'}
                badgeColor="#ba1a1a"
                badgeBg="rgba(255,218,214,0.3)"
              />
              <KPICard
                label="Drafts (Unsent)"
                value={formatMoney(stats.sums.draftsTotal, currency)}
                icon={<DraftsIcon className="w-[18px] h-[18px]" />}
                iconBg="#e2e7ff"
                footnote={`${stats.counts.draft} written — not sent to any client`}
                badge="Not released"
                badgeColor="#464555"
                badgeBg="#f2f3ff"
              />
            </div>

            <div className="mt-6 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="p-4 flex flex-col gap-4">
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => handleFilterChange(tab.key)}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm whitespace-nowrap transition-colors ${
                        activeFilter === tab.key ? 'bg-[#eaedff] text-[#3525cd] font-semibold' : 'text-[#464555] hover:bg-gray-50'
                      }`}
                    >
                      {tab.label}
                      <span
                        className="text-xs font-mono px-1.5 rounded-full"
                        style={{
                          backgroundColor: activeFilter === tab.key ? 'rgba(53,37,205,0.1)' : '#e2e7ff',
                          color: activeFilter === tab.key ? '#3525cd' : '#464555',
                        }}
                      >
                        {stats.counts[tab.key] || 0}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="relative flex-1 max-w-md min-w-[240px]">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-60" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search invoice #, client, or line item..."
                      className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#f2f3ff] text-sm text-[#131b2e] placeholder:text-[rgba(70,69,85,0.7)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#f2f3ff] text-sm font-medium text-[#131b2e] hover:bg-gray-200 transition-colors">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      All Time
                      <CaretDownIcon className="w-2 h-1.5" />
                    </button>
                    <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#f2f3ff] hover:bg-gray-200 transition-colors">
                      <FilterIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="bg-[#f2f3ff]">
                      <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Invoice ID</th>
                      <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Client</th>
                      <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Issue Date</th>
                      <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Due Date</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Amount</th>
                      <th className="text-center text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Status</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesWithStatus.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-[#464555] text-sm py-10">
                          {/* Search is server-side, so an empty table is now a
                              real "nothing matched anywhere in your account"
                              rather than "nothing on this page". Say which,
                              and name the search term so it's clear what was
                              actually looked for. */}
                          {search.trim() ? (
                            <>
                              No invoices match <span className="font-semibold text-[#131b2e]">&quot;{search.trim()}&quot;</span>.
                              <br />
                              <span className="text-xs">
                                Searched every invoice in your account — number, client, and line items.
                              </span>
                            </>
                          ) : activeFilter !== 'all' ? (
                            <>No invoices with status &quot;{activeFilter}&quot;.</>
                          ) : (
                            <>
                              No invoices yet.{' '}
                              <Link to="/invoices/new" className="text-[#3525cd] font-semibold hover:underline">
                                Create your first one
                              </Link>
                              .
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                    {invoicesWithStatus.map((inv) => (
                      <tr key={inv.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono font-semibold text-[#3525cd]">#{inv.invoiceNumber}</span>
                        </td>
                        <td className="px-4 py-4">
                          <Link to={`/clients/${inv.client.id}`} className="flex items-center gap-2 group">
                            <Avatar name={inv.client.name} status={inv.displayStatus} />
                            <div>
                              <p className="font-semibold text-[#131b2e] group-hover:text-[#3525cd] transition-colors">
                                {inv.client.name}
                              </p>
                              <p className="text-xs text-[#464555]">{inv.client.email || '—'}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-[#464555]">{formatDate(inv.issueDate)}</td>
                        <td className={`px-4 py-4 ${inv.displayStatus === 'overdue' ? 'text-[#ba1a1a] font-medium' : 'text-[#464555]'}`}>
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-semibold text-[#131b2e]">{formatMoney(inv.total, currency)}</td>
                        <td className="px-4 py-4 text-center">
                          <StatusPill status={inv.displayStatus} />
                        </td>
                        <td className="px-6 py-4 relative">
                          <div className="flex items-center justify-end gap-1 opacity-80">
                            <Link
                              to={inv.displayStatus === 'draft' ? `/invoices/${inv.id}/edit` : `/invoices/${inv.id}`}
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors inline-block"
                            >
                              {inv.displayStatus === 'draft' ? <EditIcon className="w-4 h-3.5" /> : <EyeIcon className="w-4 h-3.5" />}
                            </Link>
                            <button
                              onClick={() => setMenuId(menuId === inv.id ? null : inv.id)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                              aria-label="More actions"
                            >
                              <DotsIcon className="w-1 h-3" />
                            </button>
                          </div>
                          {menuId === inv.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuId(null)} />
                              <div className="absolute right-6 top-9 z-50 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 text-sm">
                                <Link
                                  to={`/invoices/${inv.id}`}
                                  onClick={() => setMenuId(null)}
                                  className="block px-4 py-2 text-[#131b2e] hover:bg-gray-50 transition-colors"
                                >
                                  View Invoice
                                </Link>
                                {canWrite && inv.status !== 'paid' && inv.status !== 'partially_paid' && inv.status !== 'void' && (
                                  <Link
                                    to={`/invoices/${inv.id}/edit`}
                                    onClick={() => setMenuId(null)}
                                    className="block px-4 py-2 text-[#131b2e] hover:bg-gray-50 transition-colors"
                                  >
                                    Edit
                                  </Link>
                                )}
                                {canWrite && inv.displayStatus !== 'draft' && inv.displayStatus !== 'paid' && inv.displayStatus !== 'void' && (
                                  <button
                                    onClick={() => handleMarkPaid(inv)}
                                    className="block w-full text-left px-4 py-2 text-[#3525cd] hover:bg-gray-50 transition-colors"
                                  >
                                    Mark as Paid
                                  </button>
                                )}
                                {/* Voided invoices are terminal and preserved for the
                                    record, so there is nothing left to do to them. */}
                                {canManage && inv.status !== 'void' && (
                                  <button
                                    onClick={() => handleDeleteInvoice(inv)}
                                    className="block w-full text-left px-4 py-2 text-[#ba1a1a] hover:bg-gray-50 transition-colors"
                                  >
                                    {inv.status === 'draft' && !(inv.paid > 0) ? 'Delete' : 'Void Invoice'}
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between p-4 flex-wrap gap-3">
                <p className="text-xs text-[#464555]">
                  Showing <span className="font-semibold text-[#131b2e]">{invoicesWithStatus.length}</span> of{' '}
                  <span className="font-semibold text-[#131b2e]">{pagination.total}</span> invoices
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page <= 1}
                    className={`flex items-center gap-1 h-9 px-4 rounded-xl text-xs font-medium transition-colors ${
                      page <= 1 ? 'bg-[#f2f3ff] text-[#464555] opacity-50 cursor-not-allowed' : 'bg-[#f2f3ff] text-[#131b2e] hover:bg-gray-200'
                    }`}
                  >
                    <ChevronLeftIcon className="w-1.5 h-2" />
                    Previous
                  </button>
                  <button className="w-9 h-9 rounded-xl bg-[#eaedff] text-xs font-bold text-[#3525cd]">{page}</button>
                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
                    disabled={page >= pagination.totalPages}
                    className={`flex items-center gap-1 h-9 px-4 rounded-xl text-xs font-medium transition-colors ${
                      page >= pagination.totalPages ? 'bg-[#f2f3ff] text-[#464555] opacity-50 cursor-not-allowed' : 'bg-[#f2f3ff] text-[#131b2e] hover:bg-gray-200'
                    }`}
                  >
                    Next
                    <ChevronRightIcon className="w-1.5 h-2" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 items-start">
              <div className="lg:col-span-2 bg-white rounded-xl shadow-[0px_1px_1px_rgba(0,0,0,0.05)] p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-[#131b2e]">Settlement Timeline</h3>
                    <p className="text-xs text-[#464555]">Invoice value billed vs. payments collected — last 6 months</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[#006c49]">
                    <span className="w-2 h-2 rounded-full bg-[#006c49]" />
                    {(() => {
                      // Denominator is invoices actually SENT, not `all`:
                      // a draft was never billed and a voided one was cancelled,
                      // so including them would understate the collection rate
                      // for reasons that have nothing to do with getting paid.
                      const sent = stats.counts.paid + stats.counts.pending + stats.counts.partiallyPaid;
                      return sent > 0 ? Math.round((stats.counts.paid / sent) * 100) : 0;
                    })()}% paid
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <span className="flex items-center gap-1.5 text-xs text-[#464555]">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: INDIGO }} />
                    Invoiced
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-[#464555]">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: GREEN }} />
                    Collected
                  </span>
                </div>

                {timeline.length > 0 &&
                  timeline.every((m) => m.issuedSum === 0 && m.collectedSum === 0) ? (
                  <div className="w-full aspect-[640/184] flex items-center justify-center text-xs text-[#9694a8]">
                    No invoicing or payments in the last 6 months yet.
                  </div>
                ) : (
                  <SettlementChart data={timeline} currency={currency} />
                )}
              </div>

              <div className="bg-[#e2e7ff] rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 3a6 6 0 0 0-6 6v3.6L4.5 16h15L18 12.6V9a6 6 0 0 0-6-6Z" stroke="#3525cd" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M10 19a2 2 0 0 0 4 0" stroke="#3525cd" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-[#131b2e] leading-tight">Batch Reminders</p>
                    <p className="text-[11px] text-[#464555] leading-tight">One click — all overdue</p>
                  </div>
                </div>

                <p className="text-3xl font-mono font-bold text-[#131b2e]">{stats.counts.overdue}</p>
                <p className="text-xs text-[#464555] mt-0.5">
                  {stats.counts.overdue === 1
                    ? 'overdue invoice waiting'
                    : stats.counts.overdue > 1
                      ? 'overdue invoices waiting'
                      : 'nothing overdue — all caught up'}
                </p>

                {canWrite ? (
                  <button
                    onClick={handleBatchReminders}
                    disabled={runningBatch || stats.counts.overdue === 0}
                    className="mt-4 w-full flex items-center justify-center gap-1.5 bg-[#3525cd] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#2b1fb8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {runningBatch ? 'Sending…' : 'Send Reminders'}
                    <BatchArrowIcon className="w-3.5 h-3" />
                  </button>
                ) : (
                  <p className="mt-4 text-[11px] text-[#464555]">Read-only — an admin can run reminders.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}