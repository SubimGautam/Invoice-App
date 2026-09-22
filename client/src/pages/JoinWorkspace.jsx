import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const imgChevronRight = "https://www.figma.com/api/mcp/asset/d1746a44-fd1d-4316-8e4c-0f8692bb0500.svg";

export default function JoinWorkspace() {
  const { workspace, applySession } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    setJoining(true);
    try {
      const session = await api.joinWorkspace(code);
      applySession(session);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="py-4 max-w-xl">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Workspace</span>
          <img src={imgChevronRight} alt="" className="w-1.5 h-2 opacity-50" />
          <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">Join</span>
        </div>
        <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1">Join a workspace</h1>

        <div className="mt-4 bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-6">
          <p className="text-sm text-[#464555]">
            Enter the invite code from the team member who invited you. You'll join as a{' '}
            <span className="font-semibold text-[#131b2e]">Staff</span> member — the owner can assign your role afterwards.
          </p>
          <p className="text-xs text-[#777587] mt-2">
            Currently active: <span className="font-semibold text-[#464555]">{workspace?.name || '—'}</span>
          </p>

          <form onSubmit={handleJoin} className="mt-4 flex flex-col gap-4">
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Invite code</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. K4T9P2"
                className="w-full h-11 rounded-lg bg-[#f2f3ff] px-3 text-sm font-mono tracking-widest text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={joining || code.length < 4}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-colors disabled:opacity-50"
              >
                {joining ? 'Joining...' : 'Join Workspace'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}