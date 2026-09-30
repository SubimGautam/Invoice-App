import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { api } from '../api';
import { formatMoney } from '../lib/currency';
import { ChevronRightIcon, SearchIcon, PlusIcon } from '../components/Icons';

const PERIODS = [
  { months: 0, label: 'All time' },
  { months: 1, label: 'This month' },
  { months: 3, label: 'Last 3 months' },
  { months: 6, label: 'Last 6 months' },
  { months: 12, label: 'Last 12 months' },
];

const PAGE_SIZE = 8;

function downloadCsv(filename, rows) {
  const csv = [['Date', 'Customer', 'Invoice', 'Reference', 'Method', 'Amount', 'Status']]
    .concat(rows.map((r) => [
      new Date(r.date).toLocaleDateString('en-US'),
      r.customer || '',
      r.invoiceNumber || '',
      r.reference || '',
      r.method,
      r.status === 'Refunded' ? -Math.abs(r.amount) : r.amount,
      r.status
    ]))
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function KpiCard({ label, value, sub, alert }) {
  return (
    <div className="bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-4">
      <p className="text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#777587]">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-[-0.5px] ${alert ? 'text-[#ba1a1a]' : 'text-[#131b2e]'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[#777587]">{sub}</p>
    </div>
  );
}

const inputCls = 'w-full bg-[#f2f3ff] border border-transparent focus:border-[#4f46e5] focus:bg-white outline-none rounded-xl px-3.5 py-2.5 text-[15px] text-[#131b2e] placeholder-[#a5a2bd] transition-colors';
const labelCls = 'block text-xs font-semibold text-[#464555] mb-1.5';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#131b2e]">{title}</h2>
          <button onClick={onClose} className="text-[#777587] hover:text-[#131b2e] text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'Settled') return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#dff6e9] text-[#0e7a41]">Settled</span>;
  if (status === 'Refunded') return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fff1f0] text-[#ba1a1a]">Refunded</span>;
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fff4e0] text-[#a05c00]">Processing</span>;
}

export default function Payments() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [months, setMonths] = useState(0);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // all | payment | refund | processing
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState('');

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordForm, setRecordForm] = useState({ amount: '', method: '', paymentDate: '', reference: '', notes: '' });
  const [savingRecord, setSavingRecord] = useState(false);

  const [allocating, setAllocating] = useState(null);
  const [allocInvoiceId, setAllocInvoiceId] = useState('');
  const [allocSaving, setAllocSaving] = useState(false);
  const [invoices, setInvoices] = useState([]);

  const [refunding, setRefunding] = useState(null);
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '' });
  const [refundSaving, setRefundSaving] = useState(false);

  useEffect(() => {
    load(months);
  }, [months]);

  async function load(m) {
    setLoading(true);
    setError('');
    try {
      setData(await api.getPayments(m));
      setPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const currency = data?.currency || 'NPR';
  const rows = useMemo(() => data?.rows || [], [data]);

  const methods = useMemo(() => [...new Set(rows.map((r) => r.method))].sort(), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (typeFilter !== 'all') list = list.filter((r) => r.type === typeFilter);
    if (methodFilter !== 'all') list = list.filter((r) => r.method === methodFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        [r.customer, r.invoiceNumber, r.reference, r.method, r.notes]
          .some((v) => String(v || '').toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, typeFilter, methodFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const periodLabel = PERIODS.find((p) => p.months === months)?.label || 'All time';

  function openAllocate(row) {
    setAllocating(row);
    setAllocInvoiceId('');
    setActionError('');
    api.getInvoices(1, 300)
      .then((res) => setInvoices((res.invoices || []).filter((i) => i.status !== 'draft' && i.total - i.paid > 0)))
      .catch(() => setInvoices([]));
  }

  async function handleAllocate(e) {
    e.preventDefault();
    if (!allocating || !allocInvoiceId) return;
    setAllocSaving(true);
    setActionError('');
    try {
      await api.allocatePayment(allocating.id, allocInvoiceId);
      setAllocating(null);
      await load(months);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAllocSaving(false);
    }
  }

  function openRefund(row) {
    setRefunding(row);
    setRefundForm({ amount: String(row.refundable), reason: '' });
    setActionError('');
  }

  async function handleRefund(e) {
    e.preventDefault();
    if (!refunding) return;
    setRefundSaving(true);
    setActionError('');
    try {
      await api.refundPayment(refunding.id, { amount: Number(refundForm.amount), reason: refundForm.reason || undefined });
      setRefunding(null);
      await load(months);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setRefundSaving(false);
    }
  }

  async function handleRecordUnallocated(e) {
    e.preventDefault();
    setSavingRecord(true);
    setActionError('');
    try {
      await api.recordUnallocatedPayment({
        amount: Number(recordForm.amount),
        method: recordForm.method,
        paymentDate: recordForm.paymentDate || undefined,
        reference: recordForm.reference || undefined,
        notes: recordForm.notes || undefined
      });
      setRecordOpen(false);
      setRecordForm({ amount: '', method: '', paymentDate: '', reference: '', notes: '' });
      await load(months);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSavingRecord(false);
    }
  }

  function handleExport() {
    downloadCsv(`payments-${new Date().toISOString().slice(0, 10)}.csv`, filtered);
  }

  return (
    <DashboardLayout>
      <div className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Workspace</span>
              <ChevronRightIcon className="w-1.5 h-2 opacity-50" />
              <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">Payments</span>
            </div>
            <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1">Payments</h1>
            <p className="text-sm text-[#777587] mt-0.5">Every payment that has come in or gone out of your business.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 border border-[#e2e7ff] text-[#3525cd] bg-white hover:bg-[#f4f5ff] text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => { setRecordOpen(true); setActionError(''); }}
              className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors"
            >
              <PlusIcon className="w-2.5 h-2.5" />
              Record payment
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            {error}
            <button onClick={() => load(months)} className="font-semibold underline">Retry</button>
          </div>
        )}
        {actionError && (
          <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{actionError}</div>
        )}

        {/* KPI cards */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <KpiCard label="Total collected" value={formatMoney(data?.kpis.collected, currency)} sub={`Settled · ${periodLabel}`} />
          <KpiCard
            label="Received this month"
            value={String(data?.kpis.thisMonthCount ?? 0)}
            sub={`${formatMoney(data?.kpis.thisMonthAmount, currency)} · ${data?.kpis.thisMonthCount === 1 ? 'payment' : 'payments'}`}
          />
          <KpiCard
            label="Unallocated"
            value={formatMoney(data?.kpis.unallocated, currency)}
            sub={data?.kpis.unallocated > 0 ? 'Money in — invoice unknown. Allocate it below.' : 'Nothing waiting to be linked'}
            alert={data?.kpis.unallocated > 0}
          />
          <KpiCard
            label="Refunds"
            value={`− ${formatMoney(data?.kpis.refunds, currency)}`}
            sub={`${data?.kpis.refundCount || 0} ${(data?.kpis.refundCount || 0) === 1 ? 'refund' : 'refunds'} · ${periodLabel}`}
            alert={data?.kpis.refunds > 0}
          />
          <KpiCard
            label="In progress"
            value={String(data?.kpis.processing ?? 0)}
            sub="eSewa payments awaiting client"
          />
        </div>

        {/* Toolbar */}
        <div className="mt-5 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          <div className="p-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-60" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search customer, invoice, reference or method..."
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#f2f3ff] text-sm text-[#131b2e] placeholder:text-[rgba(70,69,85,0.7)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="h-10 px-3 rounded-xl bg-[#f2f3ff] text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {PERIODS.map((p) => (
                <option key={p.months} value={p.months}>{p.label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="h-10 px-3 rounded-xl bg-[#f2f3ff] text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All types</option>
              <option value="payment">Settled</option>
              <option value="refund">Refunds</option>
              <option value="processing">Processing</option>
            </select>
            <select
              value={methodFilter}
              onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
              className="h-10 px-3 rounded-xl bg-[#f2f3ff] text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All methods</option>
              {methods.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-[#464555]">Loading payments...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="bg-[#f2f3ff]">
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Date</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Customer</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Invoice</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Reference</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Method</th>
                    <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Amount</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Status</th>
                    <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-[#464555] text-sm py-10">
                        {rows.length === 0
                          ? 'No payments yet. Record a payment against an invoice, or use "Record payment" for money received with no invoice attached.'
                          : 'No payments match your filters.'}
                      </td>
                    </tr>
                  )}
                  {pageRows.map((row) => (
                    <tr
                      key={`${row.type}-${row.id}`}
                      onClick={() => { if (row.invoiceId) navigate(`/invoices/${row.invoiceId}`); }}
                      className={`border-t border-gray-50 transition-colors ${row.invoiceId ? 'cursor-pointer hover:bg-gray-50/50' : ''}`}
                    >
                      <td className="px-6 py-3.5 whitespace-nowrap text-[#464555] font-mono text-xs">
                        {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-[#131b2e]">{row.customer || <span className="text-[#a5a2bd]">Unallocated</span>}</td>
                      <td className="px-4 py-3.5">
                        {row.invoiceNumber ? (
                          <span className="font-mono text-[#3525cd] font-semibold">#{row.invoiceNumber}</span>
                        ) : (
                          <span className="text-[#a5a2bd]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-[#464555]">{row.reference || '—'}</td>
                      <td className="px-4 py-3.5 text-[#464555]">{row.method}{row.type === 'processing' && <span className="text-xs text-[#a5a2bd]"> · eSewa</span>}</td>
                      <td className={`px-4 py-3.5 text-right font-mono font-semibold ${row.type === 'refund' ? 'text-[#ba1a1a]' : 'text-[#131b2e]'}`}>
                        {row.type === 'refund' ? `− ${formatMoney(Math.abs(row.amount), currency)}` : formatMoney(row.amount, currency)}
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={row.status} /></td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-2 text-xs font-semibold" onClick={(e) => e.stopPropagation()}>
                          {row.allocatable && (
                            <button onClick={() => openAllocate(row)} className="text-[#3525cd] hover:underline">Allocate</button>
                          )}
                          {row.refundable > 0 && (
                            <button onClick={() => openRefund(row)} className="text-[#ba1a1a] hover:underline">Refund</button>
                          )}
                          {!row.allocatable && row.refundable <= 0 && <span className="text-[#c9c6da]">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="p-4 border-t border-gray-50 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-[#464555]">
              Showing <span className="font-semibold text-[#131b2e]">{pageRows.length}</span> of{' '}
              <span className="font-semibold text-[#131b2e]">{filtered.length}</span> payments
              {filtered.length !== rows.length && ' (filtered)'}.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#464555] bg-[#f2f3ff] hover:bg-[#e2e7ff] disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-xs font-mono text-[#464555]">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#464555] bg-[#f2f3ff] hover:bg-[#e2e7ff] disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Record unallocated payment */}
      {recordOpen && (
        <Modal title="Record payment" onClose={() => setRecordOpen(false)}>
          <form onSubmit={handleRecordUnallocated} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Amount</span>
                <input
                  className={inputCls}
                  value={recordForm.amount}
                  onChange={(e) => setRecordForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') }))}
                  placeholder="0.00"
                  inputMode="decimal"
                  required
                />
              </label>
              <label className="block">
                <span className={labelCls}>Method</span>
                <input
                  className={inputCls}
                  value={recordForm.method}
                  onChange={(e) => setRecordForm((f) => ({ ...f, method: e.target.value }))}
                  placeholder="Bank Transfer, eSewa, Cash…"
                  list="payment-methods"
                  required
                />
                <datalist id="payment-methods">
                  <option value="Bank Transfer" /><option value="eSewa" /><option value="Khalti" />
                  <option value="Cash" /><option value="Cheque" /><option value="Card" /><option value="Other" />
                </datalist>
              </label>
            </div>
            <label className="block">
              <span className={labelCls}>Date received</span>
              <input
                type="date"
                className={inputCls}
                value={recordForm.paymentDate || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setRecordForm((f) => ({ ...f, paymentDate: e.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className={labelCls}>Reference <span className="font-normal text-[#a5a2bd]">(optional)</span></span>
              <input
                className={inputCls}
                value={recordForm.reference}
                onChange={(e) => setRecordForm((f) => ({ ...f, reference: e.target.value }))}
                placeholder="TXN-849201"
              />
            </label>
            <label className="block">
              <span className={labelCls}>Notes <span className="font-normal text-[#a5a2bd]">(optional)</span></span>
              <input
                className={inputCls}
                value={recordForm.notes}
                onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Which client this is from, if known"
              />
            </label>
            <p className="text-xs text-[#777587] leading-relaxed">
              Payments recorded here show under <b>Unallocated</b> until you link them to an invoice — handy when a
              bank transfer arrives without an invoice number.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setRecordOpen(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-[#464555] hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={savingRecord} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50">
                {savingRecord ? 'Saving...' : 'Record payment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Allocate modal */}
      {allocating && (
        <Modal title="Allocate payment" onClose={() => setAllocating(null)}>
          <form onSubmit={handleAllocate} className="flex flex-col gap-4">
            <p className="text-sm text-[#464555]">
              This <span className="font-semibold text-[#131b2e]">{formatMoney(allocating.amount, currency)}</span> receipt
              isn't linked to an invoice yet. Choose which invoice it belongs to.
            </p>
            <label className="block">
              <span className={labelCls}>Invoice</span>
              <select className={inputCls} value={allocInvoiceId} onChange={(e) => setAllocInvoiceId(e.target.value)} required>
                <option value="">Select an invoice…</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    #{i.invoiceNumber} — {i.client?.name || 'Client'} ({formatMoney(Math.max(0, i.total - i.paid), currency)} open)
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-[#777587]">Only sent (non-draft) invoices can receive payments.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setAllocating(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-[#464555] hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={allocSaving || !allocInvoiceId} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50">
                {allocSaving ? 'Linking...' : 'Link to invoice'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Refund modal */}
      {refunding && (
        <Modal title="Refund payment" onClose={() => setRefunding(null)}>
          <form onSubmit={handleRefund} className="flex flex-col gap-4">
            <p className="text-sm text-[#464555]">
              Refunding <span className="font-semibold text-[#131b2e]">{formatMoney(refunding.amount, currency)}</span>
              {refunding.invoiceNumber ? ` on invoice #${refunding.invoiceNumber}` : ''}. The invoice balance will be
              recalculated automatically.
            </p>
            <label className="block">
              <span className={labelCls}>Amount to refund (max {formatMoney(refunding.refundable, currency)})</span>
              <input
                className={inputCls}
                value={refundForm.amount}
                onChange={(e) => setRefundForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') }))}
                inputMode="decimal"
                required
              />
            </label>
            <label className="block">
              <span className={labelCls}>Reason <span className="font-normal text-[#a5a2bd]">(optional)</span></span>
              <input
                className={inputCls}
                value={refundForm.reason}
                onChange={(e) => setRefundForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Overcharge, cancelled service…"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setRefunding(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-[#464555] hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={refundSaving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#ba1a1a] hover:bg-[#9c1616] disabled:opacity-50">
                {refundSaving ? 'Refunding...' : 'Issue refund'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </DashboardLayout>
  );
}