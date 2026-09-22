import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import ClientModal from '../components/ClientModal';
import { api } from '../api';

const imgChevronRight = "https://www.figma.com/api/mcp/asset/d1746a44-fd1d-4316-8e4c-0f8692bb0500.svg";
const imgSearchIcon = "https://www.figma.com/api/mcp/asset/43fbf5d1-f4ec-4e81-ad71-b7cdabc39b32.svg";
const imgPlusIcon = "https://www.figma.com/api/mcp/asset/18fa134b-70d7-4533-bc70-57ddf8eb0c31.svg";

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', NPR: 'Rs. ' };

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

const EMPTY_FORM = { name: '', email: '', phone: '', street: '', city: '', state: '', zipCode: '', country: '' };

function formatAddress(c) {
  const cityState = [c.city, c.state].filter(Boolean).join(', ');
  const line2 = [cityState, c.zipCode].filter(Boolean).join(' ');
  return [c.street, line2, c.country].filter(Boolean).join(', ') || null;
}

export default function Clients() {
  const { canWrite, canManage } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [currency, setCurrency] = useState('NPR');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const currencySymbol = CURRENCY_SYMBOLS[currency] || `${currency} `;

  function formatMoney(n) {
    return `${currencySymbol}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  useEffect(() => {
    loadClients();
    api.getSettings().then((s) => setCurrency(s.currency)).catch(() => {});
  }, []);

  async function loadClients() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getClients();
      setClients(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openNewModal() {
    setEditing(null);
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(client) {
    setEditing(client);
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave(form) {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await api.updateClient(editing.id, form);
      } else {
        await api.createClient(form);
      }
      setModalOpen(false);
      await loadClients();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(client) {
    if (
      !window.confirm(
        `Delete ${client.name}? This also deletes all of their invoices and payment history. This can't be undone.`
      )
    ) {
      return;
    }
    setDeletingId(client.id);
    try {
      await api.deleteClient(client.id);
      setClients((prev) => prev.filter((c) => c.id !== client.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  return (
    <DashboardLayout>
      <div className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Workspace</span>
              <img src={imgChevronRight} alt="" className="w-1.5 h-2 opacity-50" />
              <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">Clients</span>
            </div>
            <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1">Clients</h1>
          </div>
          {canWrite && (
            <button
              onClick={openNewModal}
              className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors"
            >
              <img src={imgPlusIcon} alt="" className="w-2.5 h-2.5" />
              New Client
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            {error}
            <button onClick={loadClients} className="font-semibold underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="mt-6 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-10 text-center text-sm text-[#464555]">
            Loading clients...
          </div>
        ) : (
          <div className="mt-6 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="p-4">
              <div className="relative max-w-md">
                <img src={imgSearchIcon} alt="" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-60" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by client name or email..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#f2f3ff] text-sm text-[#131b2e] placeholder:text-[rgba(70,69,85,0.7)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="bg-[#f2f3ff]">
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Client</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Email</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Phone</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Address</th>
                    <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Outstanding</th>
                    <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-[#464555] text-sm py-10">
                        {clients.length === 0 ? (
                          <>
                            No clients yet.{' '}
                            <button onClick={openNewModal} className="text-[#3525cd] font-semibold hover:underline">
                              Add your first one
                            </button>
                            .
                          </>
                        ) : (
                          'No clients match your search.'
                        )}
                      </td>
                    </tr>
                  )}
                  {filtered.map((client) => {
                    const outstanding = Number(client.stats?.outstanding || 0);
                    return (
                      <tr key={client.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <Link to={`/clients/${client.id}`} className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-full bg-[#e2e7ff] flex items-center justify-center shrink-0">
                              <span className="text-[13px] font-semibold text-[#3525cd]">{initials(client.name)}</span>
                            </div>
                            <p className="font-semibold text-[#131b2e] group-hover:text-[#3525cd] transition-colors">
                              {client.name}
                            </p>
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-[#464555]">{client.email || '—'}</td>
                        <td className="px-4 py-4 text-[#464555]">{client.phone || '—'}</td>
                        <td className="px-4 py-4 text-[#464555] max-w-[240px] truncate">{formatAddress(client) || '—'}</td>
                        <td className={`px-4 py-4 text-right font-mono font-semibold ${outstanding > 0 ? 'text-[#ba1a1a]' : 'text-[#131b2e]'}`}>
                          {formatMoney(outstanding)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-3">
                            <Link to={`/clients/${client.id}`} className="text-xs font-semibold text-[#3525cd] hover:underline">
                              View
                            </Link>
                            {canWrite && (
                              <button
                                onClick={() => openEditModal(client)}
                                className="text-xs font-semibold text-[#3525cd] hover:underline"
                              >
                                Edit
                              </button>
                            )}
                            {canManage && (
                              <button
                                onClick={() => handleDelete(client)}
                                disabled={deletingId === client.id}
                                className="text-xs font-semibold text-[#ba1a1a] hover:underline disabled:opacity-50"
                              >
                                {deletingId === client.id ? 'Deleting...' : 'Delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-gray-50">
              <p className="text-xs text-[#464555]">
                Showing <span className="font-semibold text-[#131b2e]">{filtered.length}</span> of{' '}
                <span className="font-semibold text-[#131b2e]">{clients.length}</span> clients
              </p>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <ClientModal
          initialValues={editing || EMPTY_FORM}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSave}
          saving={saving}
          error={formError}
        />
      )}
    </DashboardLayout>
  );
}