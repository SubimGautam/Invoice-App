import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

function LockIcon() {
  return (
    <svg viewBox="0 0 16 18" className="size-4" fill="none" stroke="#464555" strokeWidth="1.5" aria-hidden="true">
      <rect x="1" y="7" width="14" height="10" rx="2" />
      <path d="M4 7V5a4 4 0 0 1 8 0v2" />
    </svg>
  );
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.resetPassword(token, password);
      setInfo(res.message || 'Password updated. You can now sign in with your new password.');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8ff] px-4 py-8">
      <div className="w-full max-w-[480px] relative">
        <div className="absolute -left-16 -top-16 size-56 rounded-full bg-[#e2dfff] opacity-60 blur-3xl pointer-events-none" />
        <div className="absolute -right-16 -bottom-16 size-56 rounded-full bg-[#6cf8bb] opacity-30 blur-3xl pointer-events-none" />

        <div className="relative bg-white rounded-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] p-8">
          <div className="flex items-center gap-2 pb-6">
            <div className="size-10 rounded-lg bg-[#4f46e5] shadow-md flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h10M4 18h13" />
              </svg>
            </div>
            <div className="text-xl font-semibold tracking-tight text-[#131b2e]">
              Bill<span className="font-bold text-[#3525cd]">flow</span>
            </div>
          </div>

          <div className="pb-6">
            <h1 className="text-xl font-semibold text-[#131b2e]">Choose a new password</h1>
            <p className="text-sm text-[#464555] mt-1">
              Your reset link is valid for 1 hour and can only be used once.
            </p>
          </div>

          {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
          {info && (
            <p className="mb-4 text-sm text-[#0e7a41] bg-[#e5f7ee] p-2.5 rounded-lg leading-relaxed">{info}</p>
          )}

          {!token ? (
            <p className="text-sm text-[#ba1a1a] bg-red-50 p-2.5 rounded-lg">
              This reset link is missing its token. Request a new link from the sign-in page.
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-[#131b2e]">
                  New password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <LockIcon />
                  </span>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 rounded-lg bg-[#f2f3ff] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.05)] pl-10 pr-4 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm" className="text-xs font-semibold text-[#131b2e]">
                  Confirm new password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <LockIcon />
                  </span>
                  <input
                    id="confirm"
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full h-11 rounded-lg bg-[#f2f3ff] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.05)] pl-10 pr-4 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-11 mt-1 flex items-center justify-center gap-2 rounded-lg bg-[#3525cd] text-white text-base font-semibold shadow-md hover:bg-[#2c1fb0] transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update password'}
                {!loading && (
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                )}
              </button>
            </form>
          )}

          <p className="pt-6 text-xs text-center text-[#464555]">
            <Link to="/login" className="font-semibold text-[#3525cd] hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}