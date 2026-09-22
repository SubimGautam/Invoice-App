import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { api } from '../api';

const imgChevronRight = "https://www.figma.com/api/mcp/asset/d1746a44-fd1d-4316-8e4c-0f8692bb0500.svg";

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', NPR: 'Rs. ' };

function emptyItem() {
  return { description: '', quantity: '1', unitPrice: '0', productId: '' };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Live preview of the invoice, shown before it's saved. The invoice number is
// assigned by the server on creation, so we show a placeholder there.
function InvoicePreview({ profile, settings, client, items, notes, issueDate, dueDate, currencySymbol, onClose, onSave, saving }) {
  const formatMoney = (n) =>
    `${currencySymbol}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const rows = items
    .map((item) => ({
      ...item,
      amount: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    }))
    .filter((item) => item.description);

  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  const discount = Math.min(Math.max(Number(settings.discount || 0), 0), subtotal);
  const taxable = subtotal - discount;
  const tax = taxable * ((Number(settings.taxRate) || 0) / 100);
  const total = taxable + tax;

  const addressLines = [
    [profile?.street, [profile?.city, profile?.state].filter(Boolean).join(', ')].filter(Boolean).join(', '),
    [profile?.zipCode, profile?.country].filter(Boolean).join(' '),
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#131b2e]">Invoice Preview</h2>
          <button onClick={onClose} className="text-sm font-semibold text-[#464555] hover:underline">Close</button>
        </div>

        {(!profile || !profile.businessName) && (
          <p className="mb-3 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
            Your business name isn't set yet — it'll be filled from Settings → Business Profile.
          </p>
        )}

        {/* The actual invoice sheet */}
        <div className="border border-gray-100 rounded-xl px-8 py-7 text-sm text-[#232336]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold text-[#131b2e]">{profile?.businessName || 'Your Business'}</p>
              {addressLines.length > 0 && (
                <p className="text-xs text-[#464555] mt-0.5 leading-relaxed">{addressLines.join('\n')}</p>
              )}
              {profile?.phone && <p className="text-xs text-[#464555] mt-0.5">Phone: {profile.phone}</p>}
              {profile?.taxNumber && <p className="text-xs text-[#464555] mt-0.5">PAN/VAT: {profile.taxNumber}</p>}
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tracking-wide text-[#131b2e]">INVOICE</p>
              <p className="text-xs text-[#464555] mt-1 font-mono">Auto-assigned on save</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-6">
            <div>
              <p className="text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] mb-1">Bill To</p>
              <p className="font-semibold text-[#131b2e]">{client?.name || 'Client'}</p>
              {client?.email && <p className="text-xs text-[#464555]">{client.email}</p>}
              {client?.phone && <p className="text-xs text-[#464555]">{client.phone}</p>}
            </div>
            <div className="text-right space-y-1 text-xs">
              <p className="flex justify-between gap-4"><span className="text-[#464555]">Issue Date</span><span className="font-semibold text-[#131b2e]">{fmtDate(issueDate)}</span></p>
              <p className="flex justify-between gap-4"><span className="text-[#464555]">Due Date</span><span className="font-semibold text-[#131b2e]">{fmtDate(dueDate)}</span></p>
              <p className="flex justify-between gap-4"><span className="text-[#464555]">Status</span><span className="font-semibold text-[#3525cd]">{settings.status === 'pending' ? 'Sent' : 'Draft'}</span></p>
            </div>
          </div>

          <table className="w-full mt-6 text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] border-b border-gray-100">
                <th className="py-2">Description</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Unit Rate</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-[#464555]">Add at least one line item to preview.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2.5 text-[#131b2e]">{r.description}</td>
                  <td className="py-2.5 text-center text-[#464555]">{r.quantity}</td>
                  <td className="py-2.5 text-right text-[#464555]">{formatMoney(r.unitPrice)}</td>
                  <td className="py-2.5 text-right font-semibold text-[#131b2e]">{formatMoney(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mt-4">
            <div className="w-56 flex flex-col gap-1.5">
              <p className="flex justify-between"><span className="text-[#464555]">Subtotal</span><span>{formatMoney(subtotal)}</span></p>
              {discount > 0 && (
                <p className="flex justify-between"><span className="text-[#464555]">Discount</span><span>− {formatMoney(discount)}</span></p>
              )}
              <p className="flex justify-between"><span className="text-[#464555]">Tax ({(settings.taxRate || 0)}%)</span><span>{formatMoney(tax)}</span></p>
              <p className="flex justify-between items-center border-t border-gray-100 pt-2 font-bold text-[#131b2e]">
                <span>TOTAL</span><span>{formatMoney(total)}</span>
              </p>
            </div>
          </div>

          {notes && (
            <div className="mt-6">
              <p className="text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] mb-1">Notes</p>
              <p className="text-xs text-[#464555]">{notes}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-[#464555] hover:bg-gray-100 transition-colors"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : settings.status === 'pending' ? 'Create & Send' : 'Save as Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState('');

  const [currency, setCurrency] = useState('NPR');
  const [taxRate, setTaxRate] = useState(0);

  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(30));
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('');
  const [items, setItems] = useState([emptyItem()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Keep submit errors visible: the form is long, so when a validation or API
  // error appears, scroll it into view AND mirror it near the action buttons.
  const topErrorBoxRef = useRef(null);
  const bottomErrorBoxRef = useRef(null);
  useEffect(() => {
    if (error) {
      const box = bottomErrorBoxRef.current || topErrorBoxRef.current;
      box?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  const currencySymbol = CURRENCY_SYMBOLS[currency] || `${currency} `;

  function formatMoney(n) {
    return `${currencySymbol}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  useEffect(() => {
    loadClients();
    api
      .getSettings()
      .then((s) => {
        setCurrency(s.currency);
        setTaxRate(Number(s.defaultTaxRate || 0));
      })
      .catch(() => {});
    api.getProfile().then((p) => setProfile(p)).catch(() => {});
    api.getProducts().then((p) => setProducts(p)).catch(() => {});
  }, []);

  async function loadClients() {
    setLoadingClients(true);
    setClientsError('');
    try {
      const data = await api.getClients();
      setClients(data);
      // A ?client=id query param (from the customer detail page) pre-selects
      // that client; otherwise default to the first one.
      const preselect = searchParams.get('client');
      if (preselect && data.some((c) => c.id === preselect)) {
        setClientId(preselect);
      } else if (data.length > 0) {
        setClientId((prev) => prev || data[0].id);
      }
    } catch (err) {
      setClientsError(err.message);
    } finally {
      setLoadingClients(false);
    }
  }

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
              // Typing your own description makes the line a custom item again.
              ...(field === 'description' ? { productId: '' } : {}),
            }
          : item
      )
    );
  }

  function pickProduct(index, productId) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      setItems((prev) => prev.map((item, i) => (i === index ? { ...item, productId: '' } : item)));
      return;
    }
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              productId: product.id,
              description: product.name,
              unitPrice: String(product.price),
            }
          : item
      )
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const rowTotals = useMemo(
    () => items.map((item) => (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
    [items]
  );
  const subtotal = useMemo(() => rowTotals.reduce((sum, n) => sum + n, 0), [rowTotals]);
  const discountValue = useMemo(
    () => Math.min(Math.max(Number(discount) || 0, 0), subtotal),
    [discount, subtotal]
  );
  const taxable = subtotal - discountValue;
  const tax = taxable * ((Number(taxRate) || 0) / 100);
  const total = taxable + tax;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!clientId) {
      setError('Please select a client.');
      return;
    }
    const cleanedItems = items
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        ...(item.productId ? { productId: item.productId } : {}),
      }))
      .filter((item) => item.description);

    if (cleanedItems.length === 0) {
      setError('Add at least one line item with a description.');
      return;
    }
    if (cleanedItems.some((item) => !(item.quantity > 0) || item.unitPrice < 0)) {
      setError('Check that quantities are greater than 0 and unit prices aren\u2019t negative.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createInvoice({
        clientId,
        issueDate,
        dueDate,
        notes,
        status,
        discount: discountValue,
        items: cleanedItems,
      });
      navigate('/dashboard', {
        state: {
          notice:
            status === 'pending'
              ? `Invoice ${created.invoiceNumber} sent to ${created.client?.name || 'the client'}.`
              : `Invoice ${created.invoiceNumber} saved as a draft — nothing was sent. Open it from the Drafts list and hit "Save & Send" when you're ready.`,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <DashboardLayout>
      <div className="py-4">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Workspace</span>
          <img src={imgChevronRight} alt="" className="w-1.5 h-2 opacity-50" />
          <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Ledger</span>
          <img src={imgChevronRight} alt="" className="w-1.5 h-2 opacity-50" />
          <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">New Invoice</span>
        </div>
        <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1 mb-6">New Invoice</h1>

        {clientsError && (
          <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            {clientsError}
            <button onClick={loadClients} className="font-semibold underline">Retry</button>
          </div>
        )}

        {!loadingClients && !clientsError && clients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-10 text-center">
            <p className="text-[#131b2e] font-semibold mb-1">You don't have any clients yet</p>
            <p className="text-sm text-[#464555] mb-4">Add a client before you can create an invoice for them.</p>
            <Link
              to="/clients"
              className="inline-flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors"
            >
              Go to Clients
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && (
              <div ref={topErrorBoxRef} className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            {/* Client + dates + status */}
            <div className="bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Client</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={loadingClients}
                  className="h-11 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                >
                  {loadingClients && <option>Loading clients...</option>}
                  {!loadingClients &&
                    clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Issue Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                  className="h-11 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="h-11 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-11 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Pending (send now)</option>
                </select>
                <p className="text-xs text-[#9694a8] leading-relaxed">
                  <span className="font-semibold text-[#464555]">Draft</span> = save without sending (no email to the client).{' '}
                  <span className="font-semibold text-[#464555]">Pending</span> = send it right away.
                </p>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Payment terms, thank-you note, etc."
                  className="rounded-lg bg-[#f2f3ff] px-3 py-2 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] resize-none"
                />
              </div>
            </div>

            {/* Line items */}
            <div className="bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="bg-[#f2f3ff]">
                      <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2 w-1/2">Product / Description</th>
                      <th className="text-center text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Qty</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Unit Rate</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Amount</th>
                      <th className="px-4 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-4 py-2">
                          <div className="flex flex-col gap-1">
                            {products.length > 0 && (
                              <select
                                value={item.productId || ''}
                                onChange={(e) => pickProduct(i, e.target.value)}
                                className="w-full h-7 rounded-md px-2 text-xs text-[#131b2e] bg-[#f2f3ff] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                              >
                                <option value="">Custom item</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                    {p.sku ? ` · ${p.sku}` : ''}
                                    {p.taxRate > 0 ? ` (${p.taxRate}% tax)` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(i, 'description', e.target.value)}
                              placeholder="Design system implementation"
                              className="w-full h-9 rounded-md px-2 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:bg-[#f2f3ff]"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.quantity}
                            onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                            className="w-20 h-9 rounded-md px-2 text-sm text-center text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:bg-[#f2f3ff]"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(i, 'unitPrice', e.target.value)}
                            className="w-28 h-9 rounded-md px-2 text-sm text-right text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:bg-[#f2f3ff]"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-[#131b2e]">
                          {formatMoney(rowTotals[i] || 0)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeItem(i)}
                            disabled={items.length === 1}
                            className="text-[#ba1a1a] text-xs font-semibold hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Remove line item"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-gray-50">
                <button
                  type="button"
                  onClick={addItem}
                  className="text-sm font-semibold text-[#3525cd] hover:underline"
                >
                  + Add line item
                </button>
              </div>

              {/* Smart calculations: subtotal → discount → tax → total */}
              <div className="flex flex-col items-end gap-2 p-4 bg-[#f2f3ff]/60 border-t border-gray-50">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-[#464555]">Discount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                    className="w-32 h-9 rounded-lg bg-white border border-gray-100 px-3 text-sm text-right text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                  />
                </div>
                <div className="flex items-center justify-between gap-12">
                  <span className="text-sm text-[#464555]">Subtotal</span>
                  <span className="text-sm font-semibold text-[#131b2e]">{formatMoney(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-12">
                  <span className="text-sm text-[#464555]">Tax ({taxRate}%)</span>
                  <span className="text-sm text-[#131b2e]">{formatMoney(tax)}</span>
                </div>
                <div className="flex items-center justify-between gap-12 border-t border-gray-200/70 pt-2.5">
                  <span className="text-sm font-semibold text-[#131b2e]">TOTAL</span>
                  <span className="text-xl font-bold text-[#3525cd]">{formatMoney(total)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {error && (
                <div ref={bottomErrorBoxRef} className="flex-1 min-w-0 bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                  {error}
                </div>
              )}
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-[#464555] hover:bg-gray-100 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-[#3525cd] bg-[#e2e7ff] hover:bg-[#d6ddfb] transition-colors"
              >
                Preview
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating...' : status === 'pending' ? 'Create & Send' : 'Save as Draft'}
              </button>
            </div>
          </form>
        )}
      </div>

      {previewOpen && (
        <InvoicePreview
          profile={profile}
          settings={{ discount: discountValue, taxRate, status }}
          client={selectedClient}
          items={items}
          notes={notes}
          issueDate={issueDate}
          dueDate={dueDate}
          currencySymbol={currencySymbol}
          onClose={() => setPreviewOpen(false)}
          onSave={handleSubmit}
          saving={submitting}
        />
      )}
    </DashboardLayout>
  );
}