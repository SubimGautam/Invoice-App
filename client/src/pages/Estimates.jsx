import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { ChevronRightIcon, PlusIcon, ConvertIcon } from '../components/Icons';
import EstimateStatusPill from '../components/EstimateStatusPill';
import { ESTIMATE_FILTERS, isExpired } from '../components/estimateStatus';
import { formatMoney, symbolFor } from '../lib/currency';
import { computeTotals, lineAmount } from '../lib/money';

const EMPTY_ITEM = { description: '', quantity: '1', unitPrice: '0' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Create / edit form. Mirrors the invoice composer closely on purpose — the
// fields are the same (client, line items, discount, notes), only the dates
// differ: an estimate has a "valid until" instead of a "due date", because a
// quote expires rather than becoming overdue.
function EstimateModal({ clients, products, settings, initialValues, onClose, onSubmit, saving, error }) {
  const [form, setForm] = useState(initialValues);
  const isEdit = Boolean(initialValues.id);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function updateItem(idx, field, value) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    }));
  }
  // Picking a saved product fills in the description AND the price, and records
  // the productId so the line stays linked to the catalog.
  function pickProduct(idx, productId) {
    const product = products.find((p) => p.id === productId);
    updateItem(idx, 'productId', productId);
    if (product) {
      setForm((f) => ({
        ...f,
        items: f.items.map((it, i) =>
          i === idx ? { ...it, productId, description: it.description || product.name, unitPrice: String(product.price ?? it.unitPrice) } : it
        )
      }));
    }
  }
  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  }
  function removeItem(idx) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  // Live total so the user sees the quote value while typing — same math the
  // server will apply (discount before tax).
  const preview = useMemo(() => {
    const sym = symbolFor(settings?.currency);
    const rows = form.items
      .map((it) => ({ ...it, amount: lineAmount(it) }))
      .filter((it) => it.description.trim());
    // Shared exact money math: discount before tax, cents-accurate, so the
    // quote value shown while editing is the value the server will store and
    // later convert into an invoice.
    const { total } = computeTotals({ items: rows, discount: form.discount }, Number(settings?.defaultTaxRate) || 0);
    return { sym, total };
  }, [form.items, form.discount, settings]);

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      clientId: form.clientId,
      issueDate: new Date(form.issueDate).toISOString(),
      validUntil: new Date(form.validUntil).toISOString(),
      discount: Number(form.discount) || 0,
      notes: form.notes || undefined,
      status: isEdit ? undefined : form.sendNow ? 'sent' : 'draft',
      items: form.items
        .filter((it) => it.description.trim())
        .map((it) => ({
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          productId: it.productId || undefined
        }))
    });
  }

  const inputCls =
    'w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4 sm:p-8">
      <div className="w-full max-w-[720px] bg-white rounded-2xl shadow-xl p-6 my-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#131b2e]">{isEdit ? 'Edit Estimate' : 'New Estimate'}</h2>
            <p className="text-xs text-[#464555] mt-0.5">
              {isEdit ? 'Update the quote details and line items.' : 'Quote work for a client before you invoice it.'}
            </p>
          </div>
          <button onClick={onClose} className="text-[#777587] hover:text-[#131b2e] text-xl leading-none" aria-label="Close">×</button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Client</label>
            <select
              required
              value={form.clientId}
              onChange={(e) => update('clientId', e.target.value)}
              className={inputCls}
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.companyName ? ` · ${c.companyName}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Issue date</label>
              <input type="date" required value={form.issueDate} onChange={(e) => update('issueDate', e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Valid until</label>
              <input type="date" required value={form.validUntil} onChange={(e) => update('validUntil', e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Discount (whole)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(e) => update('discount', e.target.value)}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Notes (shown on the estimate)</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Scope, assumptions, anything the client should read before accepting"
              className="rounded-lg bg-[#f2f3ff] px-3 py-2 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide uppercase text-[#464555]">Line items</p>
            <button type="button" onClick={addItem} className="text-xs font-semibold text-[#3525cd] hover:underline">
              + Add item
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_100px_36px] gap-2 items-center">
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    required
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    placeholder="Item description"
                    className={inputCls}
                  />
                  {products.length > 0 && (
                    <select
                      value={item.productId || ''}
                      onChange={(e) => pickProduct(idx, e.target.value)}
                      className="h-7 rounded-lg bg-[#f2f3ff] px-2 text-[11px] text-[#464555] focus:outline-none focus:ring-1 focus:ring-[#4f46e5]"
                      aria-label="Link a saved product"
                    >
                      <option value="">From catalog…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  placeholder="Qty"
                  className={inputCls}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                  placeholder="Price"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={form.items.length <= 1}
                  className="h-10 w-9 rounded-lg text-sm font-bold text-[#ba1a1a] hover:bg-red-50 disabled:opacity-30 transition-colors"
                  aria-label="Remove item"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between bg-[#f2f3ff] rounded-xl px-4 py-3">
            <span className="text-xs font-medium tracking-wide uppercase text-[#464555]">Quote total</span>
            <span className="font-mono font-bold text-[#131b2e]">{formatMoney(preview.total, settings?.currency)}</span>
          </div>

          {!isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.sendNow}
                onChange={(e) => update('sendNow', e.target.checked)}
                className="w-4 h-4 accent-[#4f46e5]"
              />
              <span className="text-sm text-[#131b2e]">
                Mark as sent
                <span className="block text-[11px] text-[#777587]">You can still email it from the estimate page.</span>
              </span>
            </label>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-[#464555] hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Estimate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Estimates() {
  const { canWrite } = useAuth();
  const navigate = useNavigate();

  const [estimates, setEstimates] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formValues, setFormValues] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    loadEstimates();
    if (canWrite) {
      api.getClients().then(setClients).catch(() => {});
      api.getProducts().then(setProducts).catch(() => {});
    }
    api.getSettings().then(setSettings).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadEstimates() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getEstimates(1, 100, filter === 'all' ? undefined : filter, search.trim() || undefined);
      setEstimates(data.estimates);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Reload when the tab or search changes (both are server-side filters, so the
  // result set is whatever the API returns — never a client-side guess).
  useEffect(() => {
    const t = setTimeout(loadEstimates, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  function openNewModal() {
    setEditing(null);
    setFormError('');
    setNotice('');
    setFormValues({
      clientId: '',
      issueDate: todayISO(),
      // Default the quote to 30 days — long enough for a client to review and
      // decide, short enough that the price isn't stale.
      validUntil: addDaysISO(30),
      discount: '0',
      notes: '',
      sendNow: false,
      items: [{ ...EMPTY_ITEM }]
    });
    setModalOpen(true);
  }

  function openEditModal(e) {
    setEditing(e);
    setFormError('');
    setNotice('');
    setFormValues({
      id: e.id,
      clientId: e.clientId,
      issueDate: toDateInput(e.issueDate),
      validUntil: toDateInput(e.validUntil),
      discount: String(e.discount ?? '0'),
      notes: e.notes || '',
      sendNow: false,
      items: (e.items || []).map((it) => ({
        description: it.description,
        quantity: String(it.quantity),
        unitPrice: String(it.unitPrice),
        productId: it.productId || '',
      }))
    });
    setModalOpen(true);
  }

  async function handleSave(form) {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await api.updateEstimate(editing.id, form);
      } else {
        await api.createEstimate(form);
      }
      setModalOpen(false);
      setNotice(editing ? 'Estimate updated.' : 'Estimate created.');
      await loadEstimates();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Convert is a one-way, money-relevant action, so it asks first and then
  // hands off to the new invoice rather than leaving the user to hunt for it.
  async function handleConvert(e) {
    if (!window.confirm(`Convert ${e.estimateNumber} to an invoice? The invoice copies the line items and pricing, and the estimate becomes read-only.`)) return;
    setBusyId(e.id);
    setError('');
    try {
      const invoice = await api.convertEstimate(e.id);
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(e) {
    if (!window.confirm(`Delete estimate ${e.estimateNumber}? This cannot be undone.`)) return;
    setBusyId(e.id);
    setError('');
    try {
      await api.deleteEstimate(e.id);
      setEstimates((prev) => prev.filter((x) => x.id !== e.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const currency = settings?.currency;

  return (
    <DashboardLayout>
      <div className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Workspace</span>
              <ChevronRightIcon className="w-1.5 h-2 opacity-50" />
              <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">Estimates</span>
            </div>
            <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1">Estimates</h1>
          </div>
          {canWrite && (
            <button
              onClick={openNewModal}
              className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors"
            >
              <PlusIcon className="w-2.5 h-2.5" />
              New Estimate
            </button>
          )}
        </div>

        {notice && <div className="mt-4 bg-[#f2f3ff] text-[#3525cd] text-sm px-4 py-3 rounded-xl">{notice}</div>}
        {error && (
          <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            {error}
            <button onClick={loadEstimates} className="font-semibold underline">Retry</button>
          </div>
        )}

        {/* Status tabs + search */}
        <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] overflow-x-auto">
            {ESTIMATE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filter === f.key ? 'bg-[#4f46e5] text-white' : 'text-[#464555] hover:bg-[#f2f3ff]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number or client…"
            className="h-9 w-full sm:w-64 rounded-xl bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
          />
        </div>

        <div className="mt-4 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          {loading ? (
            <div className="p-10 text-center text-sm text-[#464555]">Loading estimates…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="bg-[#f2f3ff]">
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Estimate</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Client</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Issued</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Valid until</th>
                    <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Amount</th>
                    <th className="text-center text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Status</th>
                    <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">{canWrite ? 'Actions' : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-[#464555] text-sm py-10">
                        {canWrite ? (
                          <>
                            No estimates here. <button onClick={openNewModal} className="text-[#3525cd] font-semibold hover:underline">Quote your first job</button>.
                          </>
                        ) : (
                          'No estimates in this workspace.'
                        )}
                      </td>
                    </tr>
                  )}
                  {estimates.map((e) => {
                    const expired = e.status === 'sent' && isExpired(e);
                    return (
                      <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <Link to={`/estimates/${e.id}`} className="font-semibold text-[#3525cd] hover:underline font-mono">
                            {e.estimateNumber}
                          </Link>
                          {e.invoice && (
                            <span className="block text-[11px] text-[#777587]">
                              → <Link to={`/invoices/${e.invoice.id}`} className="text-[#3525cd] hover:underline font-mono">{e.invoice.invoiceNumber}</Link>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-[#464555]">{e.client?.name || '—'}</td>
                        <td className="px-4 py-4 text-[#464555]">{fmtDate(e.issueDate)}</td>
                        <td className="px-4 py-4 text-[#131b2e] font-medium">
                          {fmtDate(e.validUntil)}
                          {expired && <span className="block text-[11px] font-normal text-[#ba1a1a]">Expired</span>}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-[#131b2e]">{formatMoney(e.total, currency)}</td>
                        <td className="px-4 py-4 text-center">
                          <EstimateStatusPill status={e.status} />
                        </td>
                        <td className="px-6 py-4">
                          {canWrite ? (
                            <div className="flex items-center justify-end gap-3">
                              {/* Converting needs a quote the client actually holds — a draft hasn't been
                                  sent and a decline is a "no", both refused server-side. */}
                              {e.status === 'sent' || e.status === 'accepted' ? (
                                <button
                                  onClick={() => handleConvert(e)}
                                  disabled={busyId === e.id}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#3525cd] hover:underline disabled:opacity-50"
                                >
                                  <ConvertIcon className="w-3 h-3" />
                                  {busyId === e.id ? '...' : 'Convert'}
                                </button>
                              ) : null}
                              {e.status !== 'converted' && (
                                <button
                                  onClick={() => openEditModal(e)}
                                  disabled={busyId === e.id}
                                  className="text-xs font-semibold text-[#3525cd] hover:underline disabled:opacity-50"
                                >
                                  Edit
                                </button>
                              )}
                              {!e.invoice && (
                                <button
                                  onClick={() => handleDelete(e)}
                                  disabled={busyId === e.id}
                                  className="text-xs font-semibold text-[#ba1a1a] hover:underline disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[#777587] text-right block">
                              {e.items.length} item{e.items.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-4">
          <p className="text-xs text-[#464555]">
            An estimate is a quote, not a bill — nothing is owed until you convert it. Sending one emails the client a
            link where they can accept or decline without an account, and their answer lands here (and in your
            notification feed). Accepted quotes convert to a draft invoice that copies the exact line items and pricing,
            so you never retype the numbers.
          </p>
        </div>
      </div>

      {modalOpen && formValues && (
        <EstimateModal
          clients={clients}
          products={products}
          settings={settings}
          initialValues={formValues}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSave}
          saving={saving}
          error={formError}
        />
      )}
    </DashboardLayout>
  );
}
