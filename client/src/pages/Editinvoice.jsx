import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { api } from '../api';

const imgChevronRight = "https://www.figma.com/api/mcp/asset/d1746a44-fd1d-4316-8e4c-0f8692bb0500.svg";

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', NPR: 'Rs. ' };

function toDateInput(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export default function EditInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notEditable, setNotEditable] = useState(false);

  const [clients, setClients] = useState([]);
  const [currency, setCurrency] = useState('NPR');

  const [clientId, setClientId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currencySymbol = CURRENCY_SYMBOLS[currency] || `${currency} `;

  function formatMoney(n) {
    return `${currencySymbol}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const [invoice, clientList, settings] = await Promise.all([
        api.getInvoice(id),
        api.getClients(),
        api.getSettings().catch(() => null),
      ]);

      if (invoice.status === 'paid') {
        setNotEditable(true);
        return;
      }

      setClients(clientList);
      if (settings?.currency) setCurrency(settings.currency);

      setClientId(invoice.clientId);
      setIssueDate(toDateInput(invoice.issueDate));
      setDueDate(toDateInput(invoice.dueDate));
      setStatus(invoice.status);
      setNotes(invoice.notes || '');
      setItems(
        invoice.items.map((item) => ({
          description: item.description,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        }))
      );
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { description: '', quantity: '1', unitPrice: '0' }]);
  }

  function removeItem(index) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const rowTotals = useMemo(
    () => items.map((item) => (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)),
    [items]
  );
  const subtotal = useMemo(() => rowTotals.reduce((sum, n) => sum + n, 0), [rowTotals]);

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
      await api.updateInvoice(id, {
        clientId,
        issueDate,
        dueDate,
        notes,
        status,
        items: cleanedItems,
      });
      navigate(`/invoices/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-10 text-center text-sm text-[#464555]">Loading invoice...</div>
      </DashboardLayout>
    );
  }

  if (notEditable) {
    return (
      <DashboardLayout>
        <div className="py-10 text-center">
          <p className="text-sm text-[#131b2e] font-semibold mb-1">This invoice has been paid</p>
          <p className="text-sm text-[#464555] mb-4">Paid invoices can't be edited.</p>
          <Link to={`/invoices/${id}`} className="text-sm font-semibold text-[#3525cd] hover:underline">
            Back to Invoice
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="py-10 text-center">
          <p className="text-sm text-red-600 mb-2">{loadError}</p>
          <Link to="/dashboard" className="text-sm font-semibold text-[#3525cd] hover:underline">
            Back to Invoices
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
          <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Ledger</span>
          <img src={imgChevronRight} alt="" className="w-1.5 h-2 opacity-50" />
          <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">Edit Invoice</span>
        </div>
        <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1 mb-6">Edit Invoice</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          {/* Client + dates + status */}
          <div className="bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-11 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
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
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2 w-1/2">Description</th>
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
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(i, 'description', e.target.value)}
                          placeholder="Design system implementation"
                          className="w-full h-9 rounded-md px-2 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:bg-[#f2f3ff]"
                        />
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

            <div className="flex justify-end p-4 bg-[#f2f3ff]/60 border-t border-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#464555]">Total</span>
                <span className="text-xl font-bold text-[#3525cd]">{formatMoney(subtotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link
              to={`/invoices/${id}`}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-[#464555] hover:bg-gray-100 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}