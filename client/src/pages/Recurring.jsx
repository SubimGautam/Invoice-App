import { useEffect, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const imgChevronRight = "https://www.figma.com/api/mcp/asset/d1746a44-fd1d-4316-8e4c-0f8692bb0500.svg";
const imgPlusIcon = "https://www.figma.com/api/mcp/asset/18fa134b-70d7-4533-bc70-57ddf8eb0c31.svg";

const FREQ_LABELS = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const EMPTY_ITEM = { description: '', quantity: '1', unitPrice: '0' };

function RecurringModal({ clients, initialValues, onClose, onSubmit, saving, error }) {
  const [form, setForm] = useState(initialValues);
  const isEdit = Boolean(initialValues.id);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function updateItem(idx, field, value) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    }));
  }
  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  }
  function removeItem(idx) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      clientId: form.clientId,
      description: form.description || undefined,
      frequency: form.frequency,
      startDate: new Date(form.startDate).toISOString(),
      discount: Number(form.discount) || 0,
      notes: form.notes || undefined,
      active: form.active,
      items: form.items
        .filter((it) => it.description.trim())
        .map((it) => ({
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
        })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-[#131b2e] mb-4">
          {isEdit ? 'Edit Schedule' : 'New Recurring Schedule'}
        </h2>

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Client</label>
              <select
                required
                value={form.clientId}
                onChange={(e) => update('clientId', e.target.value)}
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              >
                <option value="" disabled>Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => update('frequency', e.target.value)}
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              >
                {['weekly', 'monthly', 'quarterly', 'yearly'].map((f) => (
                  <option key={f} value={f}>{FREQ_LABELS[f]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Monthly retainer"
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">First billing date</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
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
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Notes (shown on invoice)</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Charged at the start of each month"
              className="rounded-lg bg-[#f2f3ff] px-3 py-2 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide uppercase text-[#464555]">Line items</p>
            <button
              type="button"
              onClick={addItem}
              className="text-xs font-semibold text-[#3525cd] hover:underline"
            >
              + Add item
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_90px_110px_36px] gap-2 items-center">
                <input
                  type="text"
                  required
                  value={item.description}
                  onChange={(e) => updateItem(idx, 'description', e.target.value)}
                  placeholder="Item description"
                  className="h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  placeholder="Qty"
                  className="h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                  placeholder="Price"
                  className="h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
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

          <label className="flex items-center gap-2 text-sm text-[#464555]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => update('active', e.target.checked)}
              className="w-4 h-4 accent-[#4f46e5]"
            />
            <span className="font-semibold text-[#131b2e]">Active</span>
            <span className="text-xs text-[#777587]">(inactive schedules stay saved but never bill)</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-[#464555] hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Recurring() {
  const { canWrite } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [running, setRunning] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formValues, setFormValues] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadSchedules();
    if (canWrite) api.getClients().then(setClients).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSchedules() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getRecurring();
      setSchedules(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openNewModal() {
    const today = new Date().toISOString().slice(0, 10);
    setEditing(null);
    setFormError('');
    setNotice('');
    setFormValues({ clientId: '', description: '', frequency: 'monthly', startDate: today, discount: '0', notes: '', active: true, items: [{ ...EMPTY_ITEM }] });
    setModalOpen(true);
  }

  function openEditModal(s) {
    setEditing(s);
    setFormError('');
    setNotice('');
    setFormValues({
      clientId: s.clientId,
      description: s.description || '',
      frequency: s.frequency,
      startDate: toDateInput(s.startDate || s.nextRunDate),
      discount: String(s.discount ?? '0'),
      notes: s.notes || '',
      active: s.active,
      items: (s.items || []).map((it) => ({
        description: it.description,
        quantity: String(it.quantity),
        unitPrice: String(it.unitPrice),
      })),
    });
    setModalOpen(true);
  }

  async function handleSave(form) {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await api.updateRecurring(editing.id, form);
      } else {
        await api.createRecurring(form);
      }
      setModalOpen(false);
      await loadSchedules();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(schedule) {
    setBusyId(schedule.id);
    setError('');
    try {
      await api.setRecurringActive(schedule.id, !schedule.active);
      setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, active: !s.active } : s)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(schedule) {
    if (!window.confirm(`Delete this ${FREQ_LABELS[schedule.frequency].toLowerCase()} schedule for ${schedule.client?.name}? Generated invoices are kept.`)) return;
    setBusyId(schedule.id);
    setError('');
    try {
      await api.deleteRecurring(schedule.id);
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    setError('');
    setNotice('');
    try {
      const { created } = await api.generateDueRecurring();
      setNotice(created > 0 ? `${created} invoice${created === 1 ? '' : 's'} generated.` : 'No schedules were due — next runs are in the future.');
      await loadSchedules();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Workspace</span>
              <img src={imgChevronRight} alt="" className="w-1.5 h-2 opacity-50" />
              <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">Recurring</span>
            </div>
            <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1">Recurring Invoices</h1>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRunNow}
                disabled={running}
                className="flex items-center gap-1.5 bg-white border border-[#dcdbff] text-[#3525cd] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#f2f3ff] transition-colors disabled:opacity-50"
              >
                {running ? 'Checking...' : 'Generate Now'}
              </button>
              <button
                onClick={openNewModal}
                className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors"
              >
                <img src={imgPlusIcon} alt="" className="w-2.5 h-2.5" />
                New Schedule
              </button>
            </div>
          )}
        </div>

        {notice && (
          <div className="mt-4 bg-[#f2f3ff] text-[#3525cd] text-sm px-4 py-3 rounded-xl">{notice}</div>
        )}
        {error && (
          <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            {error}
            <button onClick={loadSchedules} className="font-semibold underline">Retry</button>
          </div>
        )}

        <div className="mt-6 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          {loading ? (
            <div className="p-10 text-center text-sm text-[#464555]">Loading schedules...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="bg-[#f2f3ff]">
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Schedule</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Client</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Frequency</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Next run</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Last run</th>
                    <th className="text-center text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Status</th>
                    <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">{canWrite ? 'Actions' : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-[#464555] text-sm py-10">
                        {canWrite ? (
                          <>No schedules yet. <button onClick={openNewModal} className="text-[#3525cd] font-semibold hover:underline">Set up your first recurring invoice</button>.</>
                        ) : (
                          'No recurring schedules in this workspace.'
                        )}
                      </td>
                    </tr>
                  )}
                  {schedules.map((s) => (
                    <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-[#131b2e]">{s.description || 'Recurring invoice'}</p>
                        {s.notes && <p className="text-xs text-[#464555] max-w-[240px] truncate">{s.notes}</p>}
                      </td>
                      <td className="px-4 py-4 text-[#464555]">{s.client?.name || '—'}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-[#e2e7ff] text-[#3525cd]">
                          {FREQ_LABELS[s.frequency]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[#131b2e] font-medium">{fmtDate(s.nextRunDate)}</td>
                      <td className="px-4 py-4 text-[#464555]">{fmtDate(s.lastRunAt)}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${s.active ? 'bg-[#e5f7ee] text-[#0e7a41]' : 'bg-gray-100 text-[#464555]'}`}>
                          {s.active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {canWrite ? (
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => openEditModal(s)} className="text-xs font-semibold text-[#3525cd] hover:underline">
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggle(s)}
                              disabled={busyId === s.id}
                              className="text-xs font-semibold text-[#464555] hover:underline disabled:opacity-50"
                            >
                              {busyId === s.id ? '...' : s.active ? 'Pause' : 'Resume'}
                            </button>
                            <button
                              onClick={() => handleDelete(s)}
                              disabled={busyId === s.id}
                              className="text-xs font-semibold text-[#ba1a1a] hover:underline disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#777587] text-right block">{s.items.length} item{s.items.length === 1 ? '' : 's'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-4">
          <p className="text-xs text-[#464555]">
            Scheduled invoices are created as <span className="font-semibold text-[#131b2e]">Pending</span> on their billing date and inherit this workspace's payment terms.
            Each run advances the schedule automatically. Overdue schedules are picked up the next time the app checks — or click{' '}
            <span className="font-semibold text-[#131b2e]">Generate Now</span> to bill immediately.
          </p>
        </div>
      </div>

      {modalOpen && formValues && (
        <RecurringModal
          clients={clients}
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