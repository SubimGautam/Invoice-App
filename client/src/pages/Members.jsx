import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const imgChevronRight = "https://www.figma.com/api/mcp/asset/d1746a44-fd1d-4316-8e4c-0f8692bb0500.svg";
const imgPlusIcon = "https://www.figma.com/api/mcp/asset/18fa134b-70d7-4533-bc70-57ddf8eb0c31.svg";
const imgCopyIcon =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23818095' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect width='14' height='14' x='8' y='8' rx='2' ry='2'/><path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/></svg>"
  );

const ROLE_STYLES = {
  owner: 'bg-[#e2e7ff] text-[#3525cd]',
  admin: 'bg-[#e5f7ee] text-[#0e7a41]',
  staff: 'bg-[#fdf0d8] text-[#9a6b00]',
  viewer: 'bg-gray-100 text-[#464555]',
};

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', staff: 'Staff', viewer: 'Viewer' };

function copyText(text, onDone) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(onDone, () => onDone());
  } else {
    onDone();
  }
}

export default function Members() {
  const { canManage, role, user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [changingRoleId, setChangingRoleId] = useState(null);

  useEffect(() => {
    api
      .getMembers()
      .then((data) => setMembers(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleInvite() {
    setGenerating(true);
    setError('');
    try {
      const { inviteCode: code } = await api.inviteMember();
      setInviteCode(code);
      setCopied(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRoleChange(memberId, newRole) {
    setChangingRoleId(memberId);
    setError('');
    try {
      await api.updateMemberRole(memberId, newRole);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
    } catch (err) {
      setError(err.message);
    } finally {
      setChangingRoleId(null);
    }
  }

  async function handleRemove(member) {
    if (!window.confirm(`Remove ${member.user.name} (${member.user.email}) from this workspace?`)) return;
    setError('');
    try {
      await api.removeMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      setError(err.message);
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
              <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">Team</span>
            </div>
            <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1">Team &amp; Members</h1>
          </div>
          {canManage ? (
            <button
              onClick={handleInvite}
              disabled={generating}
              className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              <img src={imgPlusIcon} alt="" className="w-2.5 h-2.5" />
              {generating ? 'Generating...' : 'Invite Member'}
            </button>
          ) : (
            <Link
              to="/join"
              className="text-sm font-semibold text-[#3525cd] hover:underline"
            >
              Have an invite code? Join another workspace →
            </Link>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {inviteCode && (
          <div className="mt-4 bg-[#f2f3ff] border border-[#dcdbff] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#131b2e]">Share this invite code</p>
              <p className="text-xs text-[#464555] mt-0.5">
                Anyone with a Billflow account can go to <span className="font-mono">/join</span> and enter this code to
                join as a <span className="font-semibold">Staff</span> member, then you can adjust their role below.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="bg-white border border-[#dcdbff] rounded-lg px-3 py-2 text-sm font-mono font-bold text-[#3525cd] tracking-wider">
                {inviteCode}
              </code>
              <button
                onClick={() => copyText(inviteCode, () => setCopied(true))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#3525cd] bg-white border border-[#dcdbff] hover:bg-[#e2e7ff] transition-colors"
              >
                <img src={imgCopyIcon} alt="" className="w-3.5 h-3.5" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
          {loading ? (
            <div className="p-10 text-center text-sm text-[#464555]">Loading members...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="bg-[#f2f3ff]">
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">Member</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Role</th>
                    <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-4 py-2">Joined</th>
                    <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] px-6 py-2">
                      {canManage ? 'Actions' : ''}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const isCurrentUser = member.user.id === user?.id;
                    const isOwner = member.role === 'owner';
                    return (
                      <tr key={member.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#e2e7ff] flex items-center justify-center shrink-0">
                              <span className="text-[13px] font-semibold text-[#3525cd]">
                                {(member.user.name || '?').slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-[#131b2e]">
                                {member.user.name}
                                {isCurrentUser && <span className="ml-1.5 text-[11px] font-medium text-[#777587]">(you)</span>}
                              </p>
                              <p className="text-xs text-[#464555]">{member.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {canManage && !isOwner ? (
                            <select
                              value={member.role}
                              disabled={changingRoleId === member.id}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
                              className="h-8 rounded-lg bg-[#f2f3ff] px-2 text-xs font-semibold text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] disabled:opacity-50"
                            >
                              {['admin', 'staff', 'viewer'].map((r) => (
                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_STYLES[member.role]}`}>
                              {ROLE_LABELS[member.role]}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-[#464555]">
                          {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          {canManage && !isOwner ? (
                            <button
                              onClick={() => handleRemove(member)}
                              className="text-xs font-semibold text-[#ba1a1a] hover:underline"
                            >
                              Remove
                            </button>
                          ) : (
                            <span className="text-xs text-[#777587]">{isOwner ? 'Workspace owner' : ''}</span>
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
          <p className="text-sm font-semibold text-[#131b2e]">Your role: {ROLE_LABELS[role] || '—'}</p>
          <ul className="mt-2 text-xs text-[#464555] space-y-1 list-disc pl-4">
            <li><span className="font-semibold">Owner</span> — full control, including managing members &amp; workspaces.</li>
            <li><span className="font-semibold">Admin</span> — same day-to-day power as owner; can manage members but can't change the owner's role.</li>
            <li><span className="font-semibold">Staff</span> — create and edit invoices, clients, products, schedules; can't delete clients/products/invoices or manage members.</li>
            <li><span className="font-semibold">Viewer</span> — read-only access to everything.</li>
          </ul>
          {canManage && (
            <p className="mt-3 text-xs text-[#464555]">
              <Link to="/join" className="text-[#3525cd] font-semibold hover:underline">Have a code from another workspace?</Link> Sign in to join it from there.
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}