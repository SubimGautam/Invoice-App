import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M15.68 8.18c0-.57-.05-1.12-.15-1.64H8v3.1h4.3a3.68 3.68 0 0 1-1.6 2.42v2h2.58c1.51-1.39 2.4-3.44 2.4-5.88z"
      />
      <path
        fill="#34A853"
        d="M8 16c2.16 0 3.97-.72 5.29-1.94l-2.58-2a4.8 4.8 0 0 1-2.71.76 4.77 4.77 0 0 1-4.5-3.3H.85v2.07A8 8 0 0 0 8 16z"
      />
      <path
        fill="#FBBC05"
        d="M3.5 9.52A4.8 4.8 0 0 1 3.25 8c0-.53.09-1.04.25-1.52V4.41H.85A8 8 0 0 0 0 8c0 1.29.31 2.51.85 3.59z"
      />
      <path
        fill="#EA4335"
        d="M8 3.18c1.18 0 2.23.4 3.06 1.2l2.29-2.29A7.94 7.94 0 0 0 8 0 8 8 0 0 0 .85 4.41L3.5 6.48A4.77 4.77 0 0 1 8 3.18z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="#131b2e" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 20 16" className="size-4" fill="none" stroke="#464555" strokeWidth="1.5" aria-hidden="true">
      <rect x="1" y="1" width="18" height="14" rx="2" />
      <path d="M1.5 2 10 9l8.5-7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 18" className="size-4" fill="none" stroke="#464555" strokeWidth="1.5" aria-hidden="true">
      <rect x="1" y="7" width="14" height="10" rx="2" />
      <path d="M4 7V5a4 4 0 0 1 8 0v2" />
    </svg>
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 20 14" className="size-4" fill="none" stroke="#464555" strokeWidth="1.5" aria-hidden="true">
      <path d="M1 7s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
      <circle cx="10" cy="7" r="2.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 16" className="size-4" fill="none" stroke="#464555" strokeWidth="1.5" aria-hidden="true">
      <path d="M1 8s3.5-6 9-6c1.7 0 3.2.5 4.5 1.3M19 8s-1 1.8-2.8 3.4M4 4 16 15" />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8ff] px-4 py-8">
      <div className="w-full max-w-[480px] relative">
        {/* Ambient backdrop glows */}
        <div className="absolute -left-16 -top-16 size-56 rounded-full bg-[#e2dfff] opacity-60 blur-3xl pointer-events-none" />
        <div className="absolute -right-16 -bottom-16 size-56 rounded-full bg-[#6cf8bb] opacity-30 blur-3xl pointer-events-none" />

        {/* Main authentication card */}
        <div className="relative bg-white rounded-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] p-8">
          {/* Brand header */}
          <div className="flex items-center gap-2 pb-6">
            <div className="size-10 rounded-lg bg-[#4f46e5] shadow-md flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h10M4 18h13" />
              </svg>
            </div>
            <div className="text-xl font-semibold tracking-tight text-[#131b2e]">
              Bill<span className="font-bold text-[#3525cd]">flow</span>
            </div>
            <span className="ml-auto text-xs font-medium text-[#464555] bg-[#e2e7ff] rounded-full px-2 py-0.5">
              v2.4
            </span>
          </div>

          {/* Welcome headings */}
          <div className="pb-6">
            <h1 className="text-xl font-semibold text-[#131b2e]">Welcome back</h1>
            <p className="text-sm text-[#464555] mt-1">
              Enter your credentials to access your billing workspace
            </p>
          </div>

          {/* SSO providers */}
          <div className="flex gap-2 pb-4">
            <button
              type="button"
              className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg bg-[#f2f3ff] shadow-sm text-sm text-[#131b2e] hover:bg-[#e2e7ff] transition-colors"
            >
              <GoogleIcon />
              Google
            </button>
            <button
              type="button"
              className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg bg-[#f2f3ff] shadow-sm text-sm text-[#131b2e] hover:bg-[#e2e7ff] transition-colors"
            >
              <GitHubIcon />
              GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 py-4">
            <span className="flex-1 h-px bg-[#e2e7ff]" />
            <span className="text-xs tracking-wide uppercase text-[#464555]">
              Or continue with email
            </span>
            <span className="flex-1 h-px bg-[#e2e7ff]" />
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
          )}

          {/* Credential form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-[#131b2e]">
                Email address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <MailIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="alex@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 rounded-lg bg-[#f2f3ff] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.05)] pl-10 pr-4 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-[#131b2e]">
                  Password
                </label>
                <a href="#" className="text-xs text-[#3525cd] hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 rounded-lg bg-[#f2f3ff] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.05)] pl-10 pr-11 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[#e2e7ff] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <span
                className={`size-4 rounded flex items-center justify-center transition-colors ${
                  rememberMe ? 'bg-[#3525cd]' : 'bg-[#e2e7ff]'
                }`}
              >
                {rememberMe && (
                  <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none" stroke="white" strokeWidth="1.5">
                    <path d="M1 4l3 3 5-6" />
                  </svg>
                )}
              </span>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="sr-only"
              />
              <span className="text-xs text-[#464555]">Remember this device for 30 days</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="h-11 mt-1 flex items-center justify-center gap-2 rounded-lg bg-[#3525cd] text-white text-base font-semibold shadow-md hover:bg-[#2c1fb0] transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In to Workspace'}
              {!loading && (
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              )}
            </button>
          </form>

          {/* Footer prompt */}
          <p className="pt-6 text-xs text-center text-[#464555]">
            {"Don't have an account? "}
            <Link to="/signup" className="font-semibold text-[#3525cd] hover:underline">
              Sign up for free
            </Link>
          </p>
        </div>

        {/* Security trust guarantee */}
        <div className="flex items-center justify-center gap-1 mt-4">
          <svg viewBox="0 0 12 14" className="size-3" fill="none" stroke="#464555" strokeWidth="1.2" aria-hidden="true">
            <path d="M6 1 1 3v4c0 3 2.2 4.8 5 6 2.8-1.2 5-3 5-6V3L6 1Z" />
          </svg>
          <span className="text-xs font-medium tracking-tight text-[#464555]">
            Protected by 256-bit SSL encryption
          </span>
        </div>
      </div>
    </div>
  );
}