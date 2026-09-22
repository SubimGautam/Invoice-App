import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import StatusPill from '../components/StatusPill';
import { computeDisplayStatus, displayStatusLabel } from '../components/status';

// --- Icons (Figma assets) ---
const imgChevronRight = "https://www.figma.com/api/mcp/asset/d1746a44-fd1d-4316-8e4c-0f8692bb0500.svg";
const imgExportIcon = "https://www.figma.com/api/mcp/asset/fed6e5c6-77b3-428a-8cda-1e295dfdcdc3.svg";
const imgPlusIcon = "https://www.figma.com/api/mcp/asset/18fa134b-70d7-4533-bc70-57ddf8eb0c31.svg";
const imgOutstandingIcon = "https://www.figma.com/api/mcp/asset/b3072c36-2e8e-4829-b979-94a17721eaf6.svg";
const imgUpArrowIcon = "https://www.figma.com/api/mcp/asset/dc34d4bd-0a48-4812-b678-91cbb2592f0d.svg";
const imgPaidIcon = "https://www.figma.com/api/mcp/asset/c546e0f2-2dd6-48ea-be7a-5722153d230f.svg";
const imgOverdueIcon = "https://www.figma.com/api/mcp/asset/e5b6e109-b68f-47fc-be57-889f8473d30f.svg";
const imgDraftsIcon = "https://www.figma.com/api/mcp/asset/eb6c4df5-54e4-4ee5-bd09-2a4c7587f4b8.svg";
const imgSearchIcon = "https://www.figma.com/api/mcp/asset/43fbf5d1-f4ec-4e81-ad71-b7cdabc39b32.svg";
const imgCalendarIcon = "https://www.figma.com/api/mcp/asset/b96139e6-8d12-4c65-a657-b14bb30c8b58.svg";
const imgCaretDown = "https://www.figma.com/api/mcp/asset/2d626d50-ffe8-4056-b11d-6b5096c58daa.svg";
const imgFilterIcon = "https://www.figma.com/api/mcp/asset/e294acdb-83d7-4814-b055-8336c80f8470.svg";
const imgEyeIcon = "https://www.figma.com/api/mcp/asset/2b718d92-a786-4ad2-b01b-c61e33aa6449.svg";
const imgDotsIcon = "https://www.figma.com/api/mcp/asset/b2d929a9-4804-4ad3-a21d-792a9d07b793.svg";
const imgEditIcon = "https://www.figma.com/api/mcp/asset/f90f6c04-d63a-4ed6-8974-d2ee8d7665b6.svg";
const imgChevronLeft = "https://www.figma.com/api/mcp/asset/98207ea4-983b-4392-b8d2-a1360da77d63.svg";
const imgChevronRightSm = "https://www.figma.com/api/mcp/asset/f9953c37-3a07-4c53-afcd-9557c56ab77a.svg";
const imgSettlementChart = "https://www.figma.com/api/mcp/asset/15ade0b3-cf68-4cd6-83e7-a881dd6bd882.svg";
const imgBatchArrow = "https://www.figma.com/api/mcp/asset/506ce05d-8e1e-49f0-8bbc-1f0d608ed5bf.svg";

// Fallback when the server didn't attach a total (shouldn't happen — the list
// endpoint computes real totals, but this keeps the render safe).
function computeTotal(invoice) {
  return invoice.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function formatMoney(n) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
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
          <img src={icon} alt="" className="w-4.5 h-4.5" />
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
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [stats, setStats] = useState(DEFAULT_STATS);
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
  }, []);

  async function loadStats() {
    try {
      const data = await api.getInvoiceStats();
      setStats(data);
    } catch {
      // Non-fatal — KPI cards just show zeros if this fails; the invoice list still works.
    }
  }

  // Re-fetch the paginated list whenever the page OR the active filter changes.
  useEffect(() => {
    loadInvoices();
  }, [page, activeFilter]);

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
      const data = await api.getInvoices(page, 20, statusParam);
      setInvoices(data.invoices);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

  async function handleDeleteInvoice(inv) {
    setMenuId(null);
    if (!window.confirm(`Delete invoice ${inv.invoiceNumber}? Its payment history will be deleted too.`)) return;
    try {
      await api.deleteInvoice(inv.id);
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

  // Status filtering now happens on the server (see loadInvoices) — this only
  // handles search, since search stays client-side against the current page.
  const filtered = useMemo(() => {
    if (!search) return invoicesWithStatus;
    return invoicesWithStatus.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        inv.client.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [invoicesWithStatus, search]);

  const tabs = [
    { key: 'all', label: 'All Invoices' },
    { key: 'draft', label: 'Draft' },
    { key: 'pending', label: 'Sent' },
    { key: 'partiallyPaid', label: 'Partially Paid' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
  ];

  return (
    <DashboardLayout>
      <div className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Workspace</span>
              <img src={imgChevronRight} alt="" className="w-1.5 h-2 opacity-50" />
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
              <img src={imgExportIcon} alt="" className="w-3 h-3" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <Link
              to="/invoices/new"
              className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors"
            >
              <img src={imgPlusIcon} alt="" className="w-2.5 h-2.5" />
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
                value={formatMoney(stats.sums.totalOutstanding)}
                icon={imgOutstandingIcon}
                iconBg="#eaedff"
                footnote={`${stats.counts.all - stats.counts.draft - stats.counts.paid} invoices pending`}
                badge={<span className="flex items-center gap-1"><img src={imgUpArrowIcon} alt="" className="w-2.5 h-1.5" />Live</span>}
                badgeColor="#006c49"
                badgeBg="#f2f3ff"
              />
              <KPICard
                label="Paid This Month"
                value={formatMoney(stats.sums.paidThisMonth)}
                icon={imgPaidIcon}
                iconBg="rgba(111,251,190,0.3)"
                footnote={`${stats.counts.paid} settled invoices`}
                badge="On schedule"
                badgeColor="#006c49"
                badgeBg="#f2f3ff"
              />
              <KPICard
                label="Overdue"
                value={formatMoney(stats.sums.overdueTotal)}
                valueColor="#ba1a1a"
                icon={imgOverdueIcon}
                iconBg="rgba(255,218,214,0.4)"
                footnote={`${stats.counts.overdue} delayed client payments`}
                badge={stats.counts.overdue > 0 ? 'Requires action' : 'All clear'}
                badgeColor="#ba1a1a"
                badgeBg="rgba(255,218,214,0.3)"
              />
              <KPICard
                label="Drafts (Unsent)"
                value={formatMoney(stats.sums.draftsTotal)}
                icon={imgDraftsIcon}
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
                    <img src={imgSearchIcon} alt="" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-60" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by invoice # or client name..."
                      className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#f2f3ff] text-sm text-[#131b2e] placeholder:text-[rgba(70,69,85,0.7)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#f2f3ff] text-sm font-medium text-[#131b2e] hover:bg-gray-200 transition-colors">
                      <img src={imgCalendarIcon} alt="" className="w-3.5 h-3.5" />
                      All Time
                      <img src={imgCaretDown} alt="" className="w-2 h-1.5" />
                    </button>
                    <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#f2f3ff] hover:bg-gray-200 transition-colors">
                      <img src={imgFilterIcon} alt="" className="w-3.5 h-3.5" />
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
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center text-[#464555] text-sm py-10">
                          {invoicesWithStatus.length === 0 ? (
                            <>
                              No invoices{activeFilter !== 'all' ? ` with status "${activeFilter}"` : ' yet'}.{' '}
                              {activeFilter === 'all' && (
                                <Link to="/invoices/new" className="text-[#3525cd] font-semibold hover:underline">
                                  Create your first one
                                </Link>
                              )}
                              {activeFilter === 'all' && '.'}
                            </>
                          ) : (
                            'No invoices match your search.'
                          )}
                        </td>
                      </tr>
                    )}
                    {filtered.map((inv) => (
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
                        <td className="px-4 py-4 text-right font-mono font-semibold text-[#131b2e]">{formatMoney(inv.total)}</td>
                        <td className="px-4 py-4 text-center">
                          <StatusPill status={inv.displayStatus} />
                        </td>
                        <td className="px-6 py-4 relative">
                          <div className="flex items-center justify-end gap-1 opacity-80">
                            <Link
                              to={inv.displayStatus === 'draft' ? `/invoices/${inv.id}/edit` : `/invoices/${inv.id}`}
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors inline-block"
                            >
                              <img src={inv.displayStatus === 'draft' ? imgEditIcon : imgEyeIcon} alt="" className="w-4 h-3.5" />
                            </Link>
                            <button
                              onClick={() => setMenuId(menuId === inv.id ? null : inv.id)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                              aria-label="More actions"
                            >
                              <img src={imgDotsIcon} alt="" className="w-1 h-3" />
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
                                {canWrite && inv.status !== 'paid' && inv.status !== 'partially_paid' && (
                                  <Link
                                    to={`/invoices/${inv.id}/edit`}
                                    onClick={() => setMenuId(null)}
                                    className="block px-4 py-2 text-[#131b2e] hover:bg-gray-50 transition-colors"
                                  >
                                    Edit
                                  </Link>
                                )}
                                {canWrite && inv.displayStatus !== 'draft' && inv.displayStatus !== 'paid' && (
                                  <button
                                    onClick={() => handleMarkPaid(inv)}
                                    className="block w-full text-left px-4 py-2 text-[#3525cd] hover:bg-gray-50 transition-colors"
                                  >
                                    Mark as Paid
                                  </button>
                                )}
                                {canManage && (
                                  <button
                                    onClick={() => handleDeleteInvoice(inv)}
                                    className="block w-full text-left px-4 py-2 text-[#ba1a1a] hover:bg-gray-50 transition-colors"
                                  >
                                    Delete
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
                  Showing <span className="font-semibold text-[#131b2e]">{filtered.length}</span> of{' '}
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
                    <img src={imgChevronLeft} alt="" className="w-1.5 h-2" />
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
                    <img src={imgChevronRightSm} alt="" className="w-1.5 h-2" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div className="lg:col-span-2 bg-white rounded-xl shadow-[0px_1px_1px_rgba(0,0,0,0.05)] p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-[#131b2e]">Settlement Timeline</h3>
                    <p className="text-xs text-[#464555]">Average turnaround across your invoices</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[#006c49]">
                    <span className="w-2 h-2 rounded-full bg-[#006c49]" />
                    {stats.counts.all > 0 ? Math.round((stats.counts.paid / stats.counts.all) * 100) : 0}% paid
                  </span>
                </div>
                <div className="h-28">
                  <img src={imgSettlementChart} alt="Settlement timeline trend" className="w-full h-full object-contain" />
                </div>
                <div className="flex justify-between text-xs font-mono text-[#464555] mt-2">
                  <span>Week 1</span>
                  <span>Week 2</span>
                  <span>Week 3</span>
                  <span>Week 4 (Current)</span>
                </div>
              </div>

              <div className="bg-[#e2e7ff] rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold font-mono tracking-[0.6px] uppercase text-[#3525cd] mb-1">Batch Operations</p>
                  <h3 className="font-bold text-[#131b2e] mb-2">Reminders</h3>
                  <p className="text-xs text-[#464555] leading-relaxed">
                    {stats.counts.overdue > 0
                      ? `${stats.counts.overdue} overdue invoice${stats.counts.overdue > 1 ? 's' : ''} could use a reminder.`
                      : 'No overdue invoices right now — nothing to chase.'}
                  </p>
                </div>
                {canWrite ? (
                  <button
                    onClick={handleBatchReminders}
                    disabled={runningBatch || stats.counts.overdue === 0}
                    className="mt-4 flex items-center justify-center gap-1.5 bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.05)] text-sm font-semibold text-[#3525cd] px-4 py-2 rounded-xl hover:bg-[#fafbff] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {runningBatch ? 'Sending...' : 'Run Batch Reminders'}
                    <img src={imgBatchArrow} alt="" className="w-4 h-3.5" />
                  </button>
                ) : (
                  <p className="mt-4 text-xs text-[#464555]">Viewers have read-only access — an admin or staff member can run reminders.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}