import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import imgLogoutIcon from '../assets/Logout.png';

const imgBellIcon = "https://www.figma.com/api/mcp/asset/a5ba9df9-fe7a-42b3-bc1e-30920939bc2a.svg";
const imgHelpIcon = "https://www.figma.com/api/mcp/asset/00cf93c1-f1c2-4326-bdd2-b96f39af8db3.svg";
const imgChevron = "https://www.figma.com/api/mcp/asset/af9cfe37-009e-4c4c-9a8c-17f1d885ea5b.svg";
const imgSearchIcon = "https://www.figma.com/api/mcp/asset/43fbf5d1-f4ec-4e81-ad71-b7cdabc39b32.svg";

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', staff: 'Staff', viewer: 'Viewer' };
const ROLE_STYLES = {
  owner: 'bg-[#e2e7ff] text-[#3525cd]',
  admin: 'bg-[#e5f7ee] text-[#0e7a41]',
  staff: 'bg-[#fdf0d8] text-[#9a6b00]',
  viewer: 'bg-gray-100 text-[#464555]',
};

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function TopBar() {
  const { user, workspace, applySession, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef(null);

  // Workspace switcher state.
  const [wsOpen, setWsOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [wsBusy, setWsBusy] = useState(false);
  const [wsMsg, setWsMsg] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const wsRef = useRef(null);

  const refreshCount = useCallback(() => {
    api
      .getNotificationCount()
      .then(({ count }) => setUnread(count))
      .catch(() => {
        /* ignore — auth may be mid-cycle */
      });
  }, []);

  // Poll the unread count so the badge stays honest while the app runs.
  useEffect(() => {
    const t = setInterval(refreshCount, 30000);
    refreshCount();
    return () => clearInterval(t);
  }, [refreshCount]);

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Same for the workspace switcher.
  useEffect(() => {
    if (!wsOpen) return;
    function onClick(e) {
      if (wsRef.current && !wsRef.current.contains(e.target)) setWsOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [wsOpen]);

  async function toggleWs() {
    const next = !wsOpen;
    setWsOpen(next);
    setWsMsg('');
    if (next) {
      try {
        setWorkspaces(await api.getWorkspaces());
      } catch (err) {
        setWsMsg(err.message);
        setWorkspaces([]);
      }
    }
  }

  async function switchWs(target) {
    if (target.active || wsBusy) return;
    setWsBusy(true);
    setWsMsg('');
    try {
      const session = await api.activateWorkspace(target.id);
      applySession(session);
      refreshCount();
      setWsOpen(false);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setWsMsg(err.message);
    } finally {
      setWsBusy(false);
    }
  }

  async function leaveWs(target) {
    if (wsBusy) return;
    if (!window.confirm(`Leave "${target.name}"? You'll lose access to that workspace's data.`)) return;
    setWsBusy(true);
    setWsMsg('');
    try {
      const result = await api.leaveWorkspace(target.id);
      if (target.active) {
        // Leaving the workspace we're operating in — switch over to the next one.
        const first = result.remainingWorkspaces[0];
        if (first) {
          const session = await api.activateWorkspace(first.id);
          applySession(session);
          refreshCount();
        }
        setWsOpen(false);
        navigate('/dashboard', { replace: true });
      } else {
        setWorkspaces(await api.getWorkspaces());
        setWsMsg(`You left "${target.name}".`);
      }
    } catch (err) {
      setWsMsg(err.message);
    } finally {
      setWsBusy(false);
    }
  }

  async function createWs(e) {
    e.preventDefault();
    const name = newWsName.trim();
    if (!name || wsBusy) return;
    setWsBusy(true);
    setWsMsg('');
    try {
      const session = await api.createWorkspace(name);
      applySession(session);
      refreshCount();
      setWsOpen(false);
      setNewWsName('');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setWsMsg(err.message);
    } finally {
      setWsBusy(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const list = await api.getNotifications(50);
        setFeed(list);
        refreshCount();
      } catch {
        setFeed([]);
      }
    }
  }

  async function markRead(n) {
    if (!n.readAt) {
      try {
        await api.readNotification(n.id);
        setUnread((u) => Math.max(0, u - 1));
      } catch {
        /* ignore */
      }
    }
    setFeed((f) => f.map((x) => (x.id === n.id ? { ...x, readAt: x.readAt || new Date().toISOString() } : x)));
    setOpen(false);
    if (n.invoiceId) navigate(`/invoices/${n.invoiceId}`);
  }

  async function markAllRead() {
    try {
      await api.readAllNotifications();
      setFeed((f) => f.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  }

  return (
    <header className="fixed top-0 left-0 md:left-64 right-0 h-16 backdrop-blur-md bg-[rgba(250,248,255,0.9)] border-b border-[rgba(199,196,216,0.3)] shadow-[0px_1px_8px_0px_rgba(15,23,42,0.04)] flex items-center justify-between px-4 md:px-6 z-30">
      <div className="relative flex-1 max-w-md hidden sm:block">
        <img src={imgSearchIcon} alt="" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-60" />
        <input
          type="text"
          placeholder={`Search ${workspace?.name || 'billing'} invoices, clients, or amounts...`}
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-[rgba(199,196,216,0.4)] bg-white text-sm text-[#131b2e] placeholder:text-[rgba(70,69,85,0.7)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <div className="relative" ref={wsRef}>
          <button
            onClick={toggleWs}
            aria-label="Switch workspace"
            className="flex items-center gap-1.5 h-10 pl-3 pr-2.5 rounded-xl border border-[rgba(199,196,216,0.4)] bg-white text-sm font-semibold text-[#131b2e] hover:bg-gray-50 transition-colors max-w-[200px]"
          >
            <span className="truncate">{workspace?.name || 'Select workspace'}</span>
            <img src={imgChevron} alt="" className="w-2 h-1.5 opacity-60 transition-transform shrink-0" />
          </button>

          {wsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-[rgba(199,196,216,0.5)] shadow-[0px_12px_32px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col" data-testid="ws-panel">
              <div className="px-4 py-3 border-b border-[rgba(199,196,216,0.3)]">
                <p className="text-sm font-semibold text-[#131b2e]">Your workspaces</p>
              </div>

              {wsMsg && <p className="mx-3 mt-2 text-xs text-[#ba1a1a] bg-red-50 px-2 py-1.5 rounded-lg">{wsMsg}</p>}

              <div className="p-1.5">
                {workspaces.length === 0 && !wsMsg && (
                  <p className="px-3 py-4 text-center text-sm text-[#777587]">No other workspaces yet.</p>
                )}
                {workspaces.map((w) => (
                  <div key={w.id} className="flex items-center gap-1 px-2 py-1.5 rounded-xl hover:bg-[#f8f7ff] transition-colors">
                    <button
                      onClick={() => switchWs(w)}
                      disabled={w.active || wsBusy}
                      className="flex-1 flex items-center gap-2.5 min-w-0 text-left"
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${w.active ? 'bg-[#4f46e5] text-white' : 'bg-[#e2e7ff] text-[#3525cd]'}`}>
                        {(w.name || 'W').slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-[#131b2e] truncate">{w.name}</span>
                        <span className={`inline-flex mt-0.5 px-1.5 py-px rounded-full text-[10px] font-semibold ${ROLE_STYLES[w.role] || 'bg-gray-100 text-[#464555]'}`}>
                          {ROLE_LABELS[w.role] || w.role}
                        </span>
                      </span>
                      {w.active && <span className="text-[#3525cd] font-bold text-sm shrink-0">✓</span>}
                    </button>
                    {!w.active && w.role !== 'owner' && (
                      <button
                        onClick={() => leaveWs(w)}
                        disabled={wsBusy}
                        className="shrink-0 text-xs font-semibold text-[#ba1a1a] hover:underline px-2 py-1 disabled:opacity-50"
                      >
                        Leave
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-[rgba(199,196,216,0.3)] p-2">
                {creatingWs ? (
                  <form onSubmit={createWs} className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={newWsName}
                      onChange={(e) => setNewWsName(e.target.value)}
                      placeholder="Workspace name"
                      className="flex-1 h-9 min-w-0 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                    />
                    <button
                      type="submit"
                      disabled={!newWsName.trim() || wsBusy}
                      className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-colors disabled:opacity-50"
                    >
                      {wsBusy ? 'Creating...' : 'Create'}
                    </button>
                    <button type="button" onClick={() => setCreatingWs(false)} className="h-9 px-2 rounded-lg text-xs font-medium text-[#464555] hover:bg-gray-100">
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setCreatingWs(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-[#3525cd] hover:bg-[#f8f7ff] transition-colors"
                  >
                    <span className="w-5 h-5 flex items-center justify-center rounded-md bg-[#e2e7ff] text-[#3525cd] text-sm font-bold">+</span>
                    Create a new workspace
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={boxRef}>
          <button
            onClick={toggle}
            aria-label="Notifications"
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
          >
            <img src={imgBellIcon} alt="" className="w-4 h-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#ba1a1a] text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-105 bg-white rounded-2xl border border-[rgba(199,196,216,0.5)] shadow-[0px_12px_32px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col" data-testid="notif-panel">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(199,196,216,0.3)]">
                <p className="text-sm font-semibold text-[#131b2e]">Notifications</p>
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium text-[#4f46e5] hover:underline"
                >
                  Mark all read
                </button>
              </div>
              <div className="overflow-y-auto max-h-80">
                {feed.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-[#777587]">Nothing here yet.</p>
                ) : (
                  feed.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => markRead(n)}
                      className={`w-full text-left px-4 py-3 border-b border-[rgba(199,196,216,0.2)] hover:bg-[#f8f7ff] transition-colors ${n.readAt ? '' : 'bg-[#eeefff]'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[#131b2e]">{n.title}</p>
                        <span className="text-[11px] text-[#777587] shrink-0">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-xs text-[#464555] mt-0.5 leading-relaxed">{n.message}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
          <img src={imgHelpIcon} alt="" className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-[rgba(199,196,216,0.4)] mx-1" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#e2e7ff] flex items-center justify-center">
            <span className="text-xs font-semibold text-[#3525cd]">{initials(user?.name)}</span>
          </div>
          <img src={imgChevron} alt="" className="w-2 h-1.5 opacity-60 hidden sm:block" />
        </div>
        <div className="w-px h-6 bg-[rgba(199,196,216,0.4)] mx-1" />
        <button
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[rgba(199,196,216,0.4)] bg-white text-xs font-semibold text-[#464555] hover:text-[#ba1a1a] hover:bg-red-50 transition-colors"
        >
          <img src={imgLogoutIcon} alt="" className="w-3.5 h-3.5" />
          Log out
        </button>
      </div>
    </header>
  );
}