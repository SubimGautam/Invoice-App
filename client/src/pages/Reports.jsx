import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { api } from '../api';

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', NPR: 'Rs. ' };

const RANGE_OPTIONS = [
  { months: 3, label: 'Last 3 Months' },
  { months: 6, label: 'Last 6 Months' },
  { months: 12, label: 'Last 12 Months' },
  { months: 24, label: 'Last 24 Months' },
];

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [months, setMonths] = useState(12);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load(months);
  }, [months]);

  async function load(m) {
    setLoading(true);
    setError('');
    try {
      const report = await api.getReports(m);
      setData(report);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const currencySymbol = CURRENCY_SYMBOLS[data?.currency] || (data?.currency ? `${data.currency} ` : '$');

  function formatMoney(n) {
    return `${currencySymbol}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  function formatPct(n, decimals = 1) {
    return `${Number(n || 0).toFixed(decimals)}%`;
  }

  function handleExport() {
    if (!data) return;
    const rows = [
      ['Billflow Financial Report'],
      ['Period', data.period.label],
      [],
      ['KPI', 'Value'],
      ['Revenue Collected', formatMoney(data.kpis.revenueCollected)],
      ['Revenue Change vs Prior Period', formatPct(data.kpis.revenueCollectedChangePct)],
      ['Paid Invoices', data.kpis.paidInvoiceCount],
      ['Aging Receivables (Outstanding)', formatMoney(data.kpis.agingReceivablesTotal)],
      ['Open Invoices', data.kpis.openInvoiceCount],
      ['Avg DSO (days)', data.kpis.avgDSO.toFixed(1)],
      ['Realized Collection Rate', formatPct(data.kpis.collectionRate)],
      ['Estimated Tax Reserve', formatMoney(data.kpis.estTaxReserve)],
      [],
      ['Month', 'Billed', 'Collected'],
      ...data.chart.map((row) => [row.month, row.billed.toFixed(2), row.collected.toFixed(2)]),
      [],
      ['Aging Bucket', 'Invoices', 'Total', 'Share'],
      ...data.aging.buckets.map((b) => [b.label, b.count, b.total.toFixed(2), formatPct(b.pct)]),
      [],
      ['Client', 'Invoices', 'Total Billed', 'Realized Cash', 'Avg DSO', 'Share of Revenue'],
      ...data.topClients.map((c) => [
        c.name, c.invoiceCount, c.totalBilled.toFixed(2), c.realizedCash.toFixed(2),
        c.avgDSO != null ? c.avgDSO.toFixed(1) : '—', formatPct(c.shareOfRevenuePct),
      ]),
    ];
    downloadCsv(`billflow-report-${data.period.months}mo.csv`, rows);
  }

  const chartMax = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.chart.map((d) => Math.max(d.billed, d.collected)));
  }, [data]);

  return (
    <DashboardLayout>
      <div className="py-4">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold tracking-widest uppercase text-[#3525cd] bg-[#e2e7ff] rounded-full px-2.5 py-1">
                Ledger Intel · FY {new Date().getFullYear()}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-[#006c49]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]" /> Live Sync Active
              </span>
            </div>
            <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e]">
              Financial Reports & Analytics
            </h1>
            <p className="text-sm text-[#464555] mt-1 max-w-xl">
              Track cashflow velocity, invoice aging, and estimated tax reserves across all client accounts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="h-10 rounded-xl bg-[#f2f3ff] px-3 text-sm font-medium text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.months} value={opt.months}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={handleExport}
              disabled={!data}
              className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-sm text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              ↓ Export Data
            </button>
          </div>
        </div>

        {data && (
          <p className="text-xs text-[#464555] mb-4">{data.period.label}</p>
        )}

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            {error}
            <button onClick={() => load(months)} className="font-semibold underline">Retry</button>
          </div>
        )}

        {loading || !data ? (
          <div className="bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-10 text-center text-sm text-[#464555]">
            Loading report...
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs font-semibold tracking-wide uppercase text-[#464555] mb-2">Total Revenue Collected</p>
                <p className="text-2xl font-bold text-[#131b2e]">{formatMoney(data.kpis.revenueCollected)}</p>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className={data.kpis.revenueCollectedChangePct >= 0 ? 'text-[#006c49]' : 'text-[#ba1a1a]'}>
                    {data.kpis.revenueCollectedChangePct >= 0 ? '+' : ''}{formatPct(data.kpis.revenueCollectedChangePct)} vs prev period
                  </span>
                  <span className="text-[#464555]">{data.kpis.paidInvoiceCount} paid inv</span>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs font-semibold tracking-wide uppercase text-[#464555] mb-2">Aging Receivables</p>
                <p className="text-2xl font-bold text-[#131b2e]">{formatMoney(data.kpis.agingReceivablesTotal)}</p>
                <div className="flex items-center justify-between mt-2 text-xs text-[#464555]">
                  <span>{data.kpis.openInvoiceCount} open invoices</span>
                  <span>Avg DSO {data.kpis.avgDSO.toFixed(1)}d</span>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs font-semibold tracking-wide uppercase text-[#464555] mb-2">Realized Collection Rate</p>
                <p className="text-2xl font-bold text-[#131b2e]">{formatPct(data.kpis.collectionRate)}</p>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className={data.kpis.collectionRateChangePct >= 0 ? 'text-[#006c49]' : 'text-[#ba1a1a]'}>
                    {data.kpis.collectionRateChangePct >= 0 ? '+' : ''}{formatPct(data.kpis.collectionRateChangePct)} efficiency
                  </span>
                  <span className="text-[#464555]">Target: &gt;95%</span>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5">
                <p className="text-xs font-semibold tracking-wide uppercase text-[#464555] mb-2">Est. Tax Reserve</p>
                <p className="text-2xl font-bold text-[#131b2e]">{formatMoney(data.kpis.estTaxReserve)}</p>
                <p className="text-xs text-[#464555] mt-2">
                  {data.kpis.taxRate}% of revenue collected this period
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-6 mb-6">
              {/* Chart */}
              <div className="lg:col-span-8 bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-[#131b2e]">Invoicing Velocity & Cash Realization</h3>
                    <p className="text-xs text-[#464555]">Monthly gross billed volume vs. cash actually cleared.</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#464555]">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#c7c4d8]" /> Billed</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#4f46e5]" /> Cash Cleared</span>
                  </div>
                </div>

                <div className="flex items-end gap-2 h-44 border-b border-[#e2e7ff] pb-1">
                  {data.chart.map((point) => (
                    <div key={point.month} className="flex-1 flex items-end justify-center gap-0.5 h-full">
                      <div
                        className="w-1/2 rounded-t bg-[#c7c4d8]"
                        style={{ height: `${(point.billed / chartMax) * 100}%` }}
                        title={`Billed: ${formatMoney(point.billed)}`}
                      />
                      <div
                        className="w-1/2 rounded-t bg-[#4f46e5]"
                        style={{ height: `${(point.collected / chartMax) * 100}%` }}
                        title={`Collected: ${formatMoney(point.collected)}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-1">
                  {data.chart.map((point) => (
                    <span key={point.month} className="flex-1 text-center text-[10px] text-[#464555]">{point.month}</span>
                  ))}
                </div>
              </div>

              {/* Aging */}
              <div className="lg:col-span-4 bg-white rounded-xl shadow-sm p-6 flex flex-col">
                <h3 className="font-bold text-[#131b2e] mb-1">Invoice Aging Analysis</h3>
                <p className="text-xs text-[#464555] mb-4">
                  Current distribution of the {formatMoney(data.aging.totalOutstanding)} outstanding receivables.
                </p>

                <div className="h-2.5 rounded-full overflow-hidden flex mb-4 bg-[#f2f3ff]">
                  {data.aging.buckets.map((b, i) => (
                    <div
                      key={b.key}
                      style={{ width: `${b.pct}%`, backgroundColor: ['#3525cd', '#4f46e5', '#f5c94a', '#ba1a1a'][i] }}
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-3 flex-1">
                  {data.aging.buckets.map((b, i) => (
                    <div key={b.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#3525cd', '#4f46e5', '#f5c94a', '#ba1a1a'][i] }} />
                        <div>
                          <p className="text-xs font-semibold text-[#131b2e]">{b.label}</p>
                          <p className="text-xs text-[#464555]">{b.count} invoice{b.count === 1 ? '' : 's'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-[#131b2e]">{formatMoney(b.total)}</p>
                        <p className="text-xs text-[#464555]">{formatPct(b.pct)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  to="/dashboard"
                  className="mt-4 text-center text-sm font-semibold text-[#3525cd] hover:underline"
                >
                  Review {data.aging.openInvoiceCount} Open Invoice{data.aging.openInvoiceCount === 1 ? '' : 's'}
                </Link>
              </div>
            </div>

            {/* Top clients */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 pb-4 flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-[#131b2e]">Top Client Accounts & Cash Realization</h3>
                  <p className="text-xs text-[#464555]">Invoice settlement velocity and revenue share this period.</p>
                </div>
                <span className="text-xs text-[#464555]">
                  Showing top {data.topClients.length} of {data.totalClientsInPeriod} client{data.totalClientsInPeriod === 1 ? '' : 's'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="bg-[#f2f3ff]">
                      <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Client Account</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Invoices</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Total Billed</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Realized Cash</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Avg DSO</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Share of Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topClients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-sm text-[#464555] py-10">
                          No invoiced clients in this period.
                        </td>
                      </tr>
                    )}
                    {data.topClients.map((c) => (
                      <tr key={c.id} className="border-t border-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#e2e7ff] flex items-center justify-center shrink-0">
                              <span className="text-[13px] font-semibold text-[#3525cd]">{initials(c.name)}</span>
                            </div>
                            <p className="font-semibold text-[#131b2e]">{c.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-[#464555]">{c.invoiceCount}</td>
                        <td className="px-4 py-4 text-right font-semibold text-[#131b2e]">{formatMoney(c.totalBilled)}</td>
                        <td className="px-4 py-4 text-right text-[#464555]">{formatMoney(c.realizedCash)}</td>
                        <td className="px-4 py-4 text-right text-[#464555]">{c.avgDSO != null ? `${c.avgDSO.toFixed(1)}d` : '—'}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-[#f2f3ff] overflow-hidden">
                              <div className="h-full bg-[#4f46e5]" style={{ width: `${c.shareOfRevenuePct}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-[#131b2e] w-10 text-right">{formatPct(c.shareOfRevenuePct)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-gray-50 text-center">
                <Link to="/clients" className="text-sm font-semibold text-[#3525cd] hover:underline">
                  View client directory →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}