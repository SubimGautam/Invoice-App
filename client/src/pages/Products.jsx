import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { api } from '../api';

const imgChevronRight = "https://www.figma.com/api/mcp/asset/d1746a44-fd1d-4316-8e4c-0f8692bb0500.svg";
const imgSearchIcon = "https://www.figma.com/api/mcp/asset/43fbf5d1-f4ec-4e81-ad71-b7cdabc39b32.svg";
const imgPlusIcon = "https://www.figma.com/api/mcp/asset/18fa134b-70d7-4533-bc70-57ddf8eb0c31.svg";

const EMPTY_FORM = {
  name: '',
  description: '',
  sku: '',
  price: '0',
  taxRate: '0',
  unit: '',
  stock: '0',
  category: '',
};

function formatMoney(n) {
  return `Rs. ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function ProductModal({ initialValues, onClose, onSubmit, saving, error }) {
  const [form, setForm] = useState(initialValues);
  const isEdit = Boolean(initialValues.id);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      ...form,
      price: Number(form.price) || 0,
      taxRate: Number(form.taxRate) || 0,
      stock: Number(form.stock) || 0,
      description: form.description || undefined,
      sku: form.sku || undefined,
      unit: form.unit || undefined,
      category: form.category || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-[#131b2e] mb-4">
          {isEdit ? 'Edit Product' : 'New Product'}
        </h2>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Laptop"
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">SKU</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => update('sku', e.target.value)}
                placeholder="LAP-001"
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="15-inch business laptop"
              className="rounded-lg bg-[#f2f3ff] px-3 py-2 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Price</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="85000"
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Tax Rate %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.taxRate}
                onChange={(e) => update('taxRate', e.target.value)}
                placeholder="13"
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => update('unit', e.target.value)}
                placeholder="pcs"
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Stock</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) => update('stock', e.target.value)}
                placeholder="0"
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                placeholder="Electronics"
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
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getProducts();
      setProducts(data);
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

  function openEditModal(product) {
    setEditing(product);
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave(form) {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await api.updateProduct(editing.id, form);
      } else {
        await api.createProduct(form);
      }
      setModalOpen(false);
      await loadProducts();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`Delete ${product.name}? Invoices that used it will keep their line items.`)) return;
    setDeletingId(product.id);
    try {
      await api.deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  return (
    <DashboardLayout>
      <div className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Workspace</span>
              <img src={imgChevronRight} alt="" className="w-1.5 h-2 opacity-50" />
              <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">Products</span>
            </div>
            <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1">Products &amp; Services</h1>
          </div>
          <button
            onClick={openNewModal}
            className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors"
          >
            <img src={imgPlusIcon} alt="" className="w-2.5 h-2.5" />
            Add Product
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            {error}
            <button onClick={loadProducts} className="font-semibold underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="mt-6 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-10 text-center text-sm text-[#464555]">
            Loading products...
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
                  placeholder="Search by name, SKU or category..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#f2f3ff] text-sm text-[#131b2e] placeholder:text-[rgba(70,69,85,0.7)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-[#f2f3ff]">
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Product</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">SKU</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Category</th>
                    <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Price</th>
                    <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Tax</th>
                    <th className="text-center text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Unit</th>
                    <th className="text-center text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Stock</th>
                    <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-[#464555] text-sm py-10">
                        {products.length === 0 ? (
                          <>
                            No products yet.{' '}
                            <button onClick={openNewModal} className="text-[#3525cd] font-semibold hover:underline">
                              Add your first one
                            </button>
                            .
                          </>
                        ) : (
                          'No products match your search.'
                        )}
                      </td>
                    </tr>
                  )}
                  {filtered.map((product) => (
                    <tr key={product.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#e2e7ff] flex items-center justify-center shrink-0">
                            <span className="text-[13px] font-semibold text-[#3525cd]">{(product.name || '?').slice(0, 2).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-[#131b2e]">{product.name}</p>
                            {product.description && (
                              <p className="text-xs text-[#464555] max-w-[220px] truncate">{product.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[#464555] font-mono">{product.sku || '—'}</td>
                      <td className="px-4 py-4 text-[#464555]">{product.category || '—'}</td>
                      <td className="px-4 py-4 text-right font-semibold text-[#131b2e]">{formatMoney(product.price)}</td>
                      <td className="px-4 py-4 text-right text-[#464555]">{product.taxRate}%</td>
                      <td className="px-4 py-4 text-center text-[#464555]">{product.unit || '—'}</td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                            product.stock > 0 ? 'bg-[#e2e7ff] text-[#3525cd]' : 'bg-gray-100 text-[#464555]'
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(product)}
                            className="text-xs font-semibold text-[#3525cd] hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            disabled={deletingId === product.id}
                            className="text-xs font-semibold text-[#ba1a1a] hover:underline disabled:opacity-50"
                          >
                            {deletingId === product.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-gray-50">
              <p className="text-xs text-[#464555]">
                Showing <span className="font-semibold text-[#131b2e]">{filtered.length}</span> of{' '}
                <span className="font-semibold text-[#131b2e]">{products.length}</span> products. Tip: services
                businesses can leave Stock at 0 and just use Name + Price.
              </p>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <ProductModal
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