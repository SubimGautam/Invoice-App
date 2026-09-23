import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const imgChevronRight = "https://www.figma.com/api/mcp/asset/d1746a44-fd1d-4316-8e4c-0f8692bb0500.svg";
const imgBellIcon = "https://www.figma.com/api/mcp/asset/a5ba9df9-fe7a-42b3-bc1e-30920939bc2a.svg";

// A small map so each notification type gets a recognisable badge instead of a
// raw internal name. Unknown types fall back to a neutral grey label.
const TYPE_META = {
  invoice_paid: { label: 'Payment received', classes: 'bg-[#e5f7ee] text-[#0e7a41]' },
  payment: { label: 'Payment', classes: 'bg-[#e2e7ff] text-[#3525cd]' },
  refund: { label: 'Refund', classes: 'bg-[#fdf0d8] text-[#9a6b00]' },
  invoice_created: { label: 'Invoice created', classes: 'bg-[#e2e7ff] text-[#3525cd]' },
  invoice_sent: { label: 'Invoice sent', classes: 'bg-[#e2e7ff] text-[#3525cd]' },
  reminder: { label: 'Reminder', classes: 'bg-[#fdf0d8] text-[#9a6b00]' },
  reminder_sent: { label: 'Reminder sent', classes: 'bg-[#fdf0d8] text-[#9a6b00]' },
  overdue: { label: 'Overdue', classes: 'bg-[#fdecec] text-[#ba1a1a]' },
};

function typeMeta(type) {
  return TYPE_META[type] || { label: type || 'Notification', classes: 'bg-gray-100 text-[#464555]' };
}

function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fullDate(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

const PAGE_SIZE = 20;

export default function Notifications() {
  const { workspace } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [markingAll, setMarkingAll] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    load(page);
  }, [page]);

  async function load(p) {
    setLoading(true);
    setError('');
    try {
      const { notifications, total: t, unreadCount } = await api.getNotifications(PAGE_SIZE, p);
      setItems(notifications);
      setTotal(t);
      setUnread(unreadCount);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const visible = filter === 'unread' ? items.filter((n) => !n.readAt) : items;

  async function openNotification(n) {
    if (!n.readAt) {
      try {
        await api.readNotification(n.id);
        setUnread((u) => Math.max(0, u - 1));
      } catch {
        /* non-fatal */
      }
    }
    // The notification itself may still be on this page; flip it visually.
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, readAt: x.readAt || new Date().toISOString() } : x)));
    if (n.invoiceId) navigate(`/invoices/${n.invoiceId}`);
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await api.readAllNotifications();
      setItems((list) => list.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
      setUnread(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setMarkingAll(false);
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
              <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">Notifications</span>
            </div>
            <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1">Notifications</h1>
            <p className="text-sm text-[#777587] mt-0.5">
              {workspace?.name ? `Activity in ${workspace.name}` : 'Your activity feed'} — payments, invoices, reminders and overdue flags.
            </p>
          </div>
          <button
            onClick={markAllRead}
            disabled={unread === 0 || markingAll}
            className="flex items-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors"
          >
            <img src={imgBellIcon} alt="" className="w-3.5 h-3.5" />
            {markingAll ? 'Marking…' : unread === 0 ? 'All read' : `Mark all read (${unread})`}
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            {error}
            <button onClick={() => load(page)} className="font-semibold underline">Retry</button>
          </div>
        )}

        <div className="mt-6 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          {/* Filter tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3 px-5 pt-4 border-b border-[rgba(199,196,216,0.2)] pb-0">
            <div className="flex items-center gap-1">
              {['all', 'unread'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-t-xl text-sm font-semibold transition-colors ${
                    filter === f
                      ? 'text-[#3525cd] border-b-2 border-[#4f46e5]'
                      : 'text-[#464555] hover:text-[#131b2e]'
                  }`}
                >
                  {f === 'all' ? `All (${total})` : `Unread (${unread})`}
                </button>
              ))}
            </div>
            <span className="text-xs text-[#777587] pb-2">
              Showing <span className="font-semibold text-[#131b2e]">{visible.length}</span> of {total}
            </span>
          </div>

          {/* Feed */}
          {loading ? (
            <p className="px-6 py-12 text-center text-sm text-[#777587]">Loading notifications…</p>
          ) : visible.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-semibold text-[#131b2e]">
                {filter === 'unread' ? 'You’re all caught up' : 'Nothing here yet'}
              </p>
              <p className="text-sm text-[#777587] mt-1">
                {filter === 'unread'
                  ? 'No unread notifications right now.'
                  : 'Payment, invoice, reminder and overdue events will show up here.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(199,196,216,0.15)]">
              {visible.map((n) => {
                const meta = typeMeta(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n)}
                    className="w-full text-left px-5 py-4 hover:bg-[#f8f7ff] transition-colors flex items-start gap-3"
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.readAt ? 'bg-transparent' : 'bg-[#4f46e5]'}`}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.classes}`}>
                          {meta.label}
                        </span>
                        <span className="text-[11px] font-mono text-[#777587]">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-sm font-semibold text-[#131b2e] mt-1.5">{n.title}</p>
                      <p className="text-[13px] text-[#464555] mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-[11px] text-[#9694a8] mt-1">{fullDate(n.createdAt)}</p>
                    </div>
                    {n.invoiceId && (
                      <span className="text-xs font-semibold text-[#4f46e5] shrink-0 mt-2">View invoice →</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-[rgba(199,196,216,0.2)]">
              <span className="text-xs text-[#777587]">
                Page <span className="font-semibold text-[#131b2e]">{page}</span> of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e7ff] text-sm font-semibold text-[#3525cd] hover:bg-[#f4f5ff] disabled:opacity-50 transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-[#e2e7ff] text-sm font-semibold text-[#3525cd] hover:bg-[#f4f5ff] disabled:opacity-50 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}