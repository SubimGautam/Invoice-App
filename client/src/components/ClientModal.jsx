import { useState } from 'react';

// Shared add/edit modal for clients, used by the Clients list page and the
// customer detail page so both stay identical.
export default function ClientModal({ initialValues, onClose, onSubmit, saving, error }) {
  const [form, setForm] = useState(initialValues);
  const isEdit = Boolean(initialValues.id);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-[#131b2e] mb-4">
          {isEdit ? 'Edit Client' : 'New Client'}
        </h2>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">
              Name
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Acme Global Ltd."
              className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="ap@acmeglobal.com"
              className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">
              Phone
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="+1 555 000 0000"
              className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">
              Street Address
            </label>
            <input
              type="text"
              value={form.street}
              onChange={(e) => update('street', e.target.value)}
              placeholder="123 Client Ave"
              className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="Austin"
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">State</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                placeholder="TX"
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Zip Code</label>
              <input
                type="text"
                value={form.zipCode}
                onChange={(e) => update('zipCode', e.target.value)}
                placeholder="78701"
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => update('country', e.target.value)}
                placeholder="United States"
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
          </div>

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
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}