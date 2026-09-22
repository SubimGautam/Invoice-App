import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import ClientModal from '../components/ClientModal';
import StatusPill from '../components/StatusPill';
import { computeDisplayStatus } from '../components/status';
import { api } from '../api';

const imgChevronRight = "https://www.figma.com/api/mcp/asset/d1746a44-fd1d-4316-8e4c-0f8692bb0500.svg";
const imgPlusIcon = "https://www.figma.com/api/mcp/asset/18fa134b-70d7-4533-bc70-57ddf8eb0c31.svg";

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', NPR: 'Rs. ' };

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function formatAddress(c) {
  if (!c) return null;
  const cityState = [c.city, c.state].filter(Boolean).join(', ');
  const line2 = [cityState, c.zipCode].filter(Boolean).join(' ');
  return [c.street, line2, c.country].filter(Boolean).join(', ') || null;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function SummaryCard({ label, value, sub, valueColor, iconBg, dot }) {
  return (
    <div className="flex-1 min-w-[180px] bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-5">
      <p className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555] mb-2">{label}</p>
      <p className="text-[22px] font-mono font-bold tracking-[-0.7px]" style={{ color: valueColor || '#131b2e' }}>
        {value}
      </p>
      <p className="text-xs text-[#464555] mt-1">{sub}</p>
      {dot && <div className="mt-3 h-0.5 rounded-full" style={{ backgroundColor: iconBg }} />}
    </div>
  );
}

// Customer detail page: one client's contact info + financial summary + every
// invoice with its real (tax-inclusive, discount-aware) totals.
export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canWrite, canManage } = useAuth();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currency, setCurrency] = useState('NPR');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const currencySymbol = CURRENCY_SYMBOLS[currency] || `${currency} `;

  function formatMoney(n) {
    return `${currencySymbol}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [data, settings] = await Promise.all([
        api.getClient(id),
        api.getSettings().catch(() => null),
      ]);
      setClient(data);
      if (settings?.currency) setCurrency(settings.currency);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(form) {
    setSaving(true);
    setFormError('');
    try {
      await api.updateClient(id, form);
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete ${client?.name}? This also deletes all of their invoices and payment history. This can't be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api.deleteClient(id);
      navigate('/clients');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const invoices = client?.invoices || [];
  const summary = client?.summary || { count: 0, billed: 0, paid: 0, outstanding: 0 };
  const address = useMemo(() => formatAddress(client), [client]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-10 text-center text-sm text-[#464555]">Loading customer...</div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="py-10 text-center">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <Link to="/clients" className="text-sm font-semibold text-[#3525cd] hover:underline">
            Back to Customers
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="py-4">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Workspace</span>
          <img src={imgChevronRight} alt="" className="w-1.5 h-2 opacity-50" />
          <Link to="/clients" className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555] hover:text-[#3525cd]">
            Customers
          </Link>
          <img src={imgChevronRight} alt="" className="w-1.5 h-2 opacity-50" />
          <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">{client.name}</span>
        </div>
        <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1 mb-6">Customer Detail</h1>

        {/* Contact card + actions */}
        <div className="bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#e2e7ff] flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-[#3525cd]">{initials(client.name)}</span>
              </div>
              <div>
                <p className="text-lg font-bold text-[#131b2e]">{client.name}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-[#464555]">
                  {client.email && <span>{client.email}</span>}
                  {client.phone && <span>{client.phone}</span>}
                  {address && <span className="max-w-md truncate">{address}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {canWrite && (
                <Link
                  to={`/invoices/new?client=${client.id}`}
                  className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors"
                >
                  <img src={imgPlusIcon} alt="" className="w-2.5 h-2.5" />
                  New Invoice
                </Link>
              )}
              {canWrite && (
                <button
                  onClick={() => {
                    setFormError('');
                    setModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-[#3525cd] bg-[#e2e7ff] hover:bg-[#d6ddfb] transition-colors"
                >
                  Edit
                </button>
              )}
              {canManage && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-[#ba1a1a] bg-[#ffe9e7] hover:bg-[#ffdcd9] transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Financial summary */}
        <div className="flex flex-wrap gap-4 mt-4">
          <SummaryCard label="Invoices" value={summary.count} sub="all time" iconBg="#e2e7ff" />
          <SummaryCard label="Total Billed" value={formatMoney(summary.billed)} sub="incl. tax" iconBg="#eaedff" />
          <SummaryCard label="Collected" value={formatMoney(summary.paid)} sub="recorded payments" iconBg="rgba(111,251,190,0.4)" />
          <SummaryCard
            label="Outstanding"
            value={formatMoney(summary.outstanding)}
            valueColor={summary.outstanding > 0 ? '#ba1a1a' : '#131b2e'}
            sub={summary.outstanding > 0 ? 'still to be collected' : 'nothing due'}
            iconBg="rgba(255,218,214,0.4)"
          />
        </div>

        {/* Invoice history */}
        <div className="mt-6 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <h3 className="font-bold text-[#131b2e]">Invoice History</h3>
            <p className="text-xs text-[#464555]">
              <span className="font-semibold text-[#131b2e]">{summary.count}</span> invoice{summary.count === 1 ? '' : 's'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-[#f2f3ff]">
                  <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Invoice ID</th>
                  <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Issue Date</th>
                  <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Due Date</th>
                  <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Amount</th>
                  <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Paid</th>
                  <th className="text-center text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Status</th>
                  <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-[#464555] text-sm py-10">
                      No invoices yet.{' '}
                      <Link to={`/invoices/new?client=${client.id}`} className="text-[#3525cd] font-semibold hover:underline">
                        Create one for {client.name}
                      </Link>
                      .
                    </td>
                  </tr>
                )}
                {invoices.map((inv) => {
                  const ds = computeDisplayStatus(inv);
                  return (
                    <tr key={inv.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/invoices/${inv.id}`} className="font-mono font-semibold text-[#3525cd] hover:underline">
                          #{inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-[#464555]">{formatDate(inv.issueDate)}</td>
                      <td className={`px-4 py-4 ${ds === 'overdue' ? 'text-[#ba1a1a] font-medium' : 'text-[#464555]'}`}>
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-semibold text-[#131b2e]">{formatMoney(inv.total)}</td>
                      <td className="px-4 py-4 text-right font-mono text-[#464555]">{formatMoney(inv.paid)}</td>
                      <td className="px-4 py-4 text-center">
                        <StatusPill status={ds} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link to={`/invoices/${inv.id}`} className="text-xs font-semibold text-[#3525cd] hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ClientModal
          initialValues={client}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSave}
          saving={saving}
          error={formError}
        />
      )}
    </DashboardLayout>
  );
}