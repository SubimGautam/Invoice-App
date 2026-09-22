import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M15.68 8.18c0-.57-.05-1.12-.15-1.64H8v3.1h4.3a3.68 3.68 0 0 1-1.6 2.42v2h2.58c1.51-1.39 2.4-3.44 2.4-5.88z" />
      <path fill="#34A853" d="M8 16c2.16 0 3.97-.72 5.29-1.94l-2.58-2a4.8 4.8 0 0 1-2.71.76 4.77 4.77 0 0 1-4.5-3.3H.85v2.07A8 8 0 0 0 8 16z" />
      <path fill="#FBBC05" d="M3.5 9.52A4.8 4.8 0 0 1 3.25 8c0-.53.09-1.04.25-1.52V4.41H.85A8 8 0 0 0 0 8c0 1.29.31 2.51.85 3.59z" />
      <path fill="#EA4335" d="M8 3.18c1.18 0 2.23.4 3.06 1.2l2.29-2.29A7.94 7.94 0 0 0 8 0 8 8 0 0 0 .85 4.41L3.5 6.48A4.77 4.77 0 0 1 8 3.18z" />
    </svg>
  );
}

function WorkEmailIcon() {
  return (
    <svg viewBox="0 0 20 16" className="size-4" fill="none" stroke="#3525cd" strokeWidth="1.5" aria-hidden="true">
      <rect x="1" y="1" width="18" height="14" rx="2" />
      <path d="M1.5 2 10 9l8.5-7" />
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-[#006c49]" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="7" />
      <path d="M5 8.2 7.2 10.4 11.2 5.8" />
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

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
];

function passwordChecks(password) {
  return {
    length: password.length >= 8,
    number: /\d/.test(password),
    uppercase: /[A-Z]/.test(password),
  };
}

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const checks = passwordChecks(password);
  const checksPassed = Object.values(checks).filter(Boolean).length;
  const strengthLabel = checksPassed === 3 ? 'Strong' : checksPassed === 2 ? 'Good' : checksPassed === 1 ? 'Weak' : '';
  const strengthColor = checksPassed === 3 ? '#006c49' : checksPassed === 2 ? '#3525cd' : '#b45309';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }
    setLoading(true);
    try {
      await signup({
        name: fullName,
        email,
        password,
        businessName,
        businessEmail,
        businessPhone,
        street,
        city,
        state,
        zipCode,
        country
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-5xl grid lg:grid-cols-12 gap-8">
        {/* Left column: registration card */}
        <div className="lg:col-span-7 relative bg-white rounded-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] p-8 lg:p-10 overflow-hidden">
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-[#e2dfff]/20 blur-3xl pointer-events-none" />

          {/* Brand */}
          <div className="relative flex items-center gap-3 mb-6">
            <div className="size-10 rounded-xl bg-[#3525cd] shadow-md flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16M4 12h10M4 18h13" />
              </svg>
            </div>
            <div className="text-xl font-semibold tracking-tight text-[#131b2e]">
              Bill<span className="font-bold text-[#3525cd]">flow</span>
            </div>
          </div>

          {/* Header */}
          <div className="relative mb-6">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase bg-[#e2dfff] text-[#3525cd] rounded-full px-2.5 py-1 mb-2">
              100% Free, Forever
            </span>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#131b2e] leading-tight">
              Create your free Billflow account
            </h1>
            <p className="text-sm text-[#464555] mt-1">
              No credit card required. No trial, no hidden fees — free forever.
            </p>
          </div>

          {/* SSO */}
          <div className="relative flex flex-col sm:flex-row gap-3 mb-4">
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2.5 h-11 rounded-lg bg-[#f2f3ff] shadow-sm text-sm font-medium text-[#131b2e] hover:bg-[#e2e7ff] transition-colors"
            >
              <GoogleIcon />
              Sign up with Google
            </button>
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2.5 h-11 rounded-lg bg-[#f2f3ff] shadow-sm text-sm font-medium text-[#131b2e] hover:bg-[#e2e7ff] transition-colors"
            >
              <WorkEmailIcon />
              Sign up with Work Email
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center gap-4 py-2 mb-4">
            <span className="flex-1 h-px bg-[#e2e7ff]" />
            <span className="text-xs tracking-wide uppercase text-[#777587]">Or complete profile</span>
            <span className="flex-1 h-px bg-[#e2e7ff]" />
          </div>

          {error && (
            <p className="relative mb-4 text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative flex flex-col gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fullName" className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    id="fullName"
                    type="text"
                    required
                    placeholder="Alex Morgan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-11 rounded-lg bg-white border border-[#e2e7ff] shadow-sm pl-3.5 pr-9 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                  />
                  {fullName && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle />
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                  Work Email
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="alex@morgandesign.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 rounded-lg bg-white border border-[#e2e7ff] shadow-sm pl-3.5 pr-9 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                  />
                  {email.includes('@') && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle />
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="businessName" className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                  Business Name
                </label>
                <input
                  id="businessName"
                  type="text"
                  required
                  placeholder="Morgan Design Studio"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full h-11 rounded-lg bg-white border border-[#e2e7ff] shadow-sm px-3.5 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                  Primary Currency
                </span>
                <div className="flex gap-1.5 bg-[#f2f3ff] rounded-lg p-1">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setCurrency(c.code)}
                      className={`flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                        currency === c.code
                          ? 'bg-white text-[#3525cd] shadow-sm'
                          : 'text-[#464555] hover:text-[#131b2e]'
                      }`}
                    >
                      {c.code}
                      <span className="opacity-70">{c.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="businessEmail" className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                  Business Email <span className="text-[#9694a8]">(optional)</span>
                </label>
                <input
                  id="businessEmail"
                  type="email"
                  placeholder="billing@morgandesign.io"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  className="w-full h-11 rounded-lg bg-white border border-[#e2e7ff] shadow-sm px-3.5 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="businessPhone" className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                  Business Phone <span className="text-[#9694a8]">(optional)</span>
                </label>
                <input
                  id="businessPhone"
                  type="text"
                  placeholder="+1 555 000 0000"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  className="w-full h-11 rounded-lg bg-white border border-[#e2e7ff] shadow-sm px-3.5 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
              </div>
            </div>

            {/* Business address — shows on your invoices and their PDFs */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="street" className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                Street Address <span className="text-[#9694a8]">(optional)</span>
              </label>
              <input
                id="street"
                type="text"
                placeholder="123 Design Ave, Suite 4"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full h-11 rounded-lg bg-white border border-[#e2e7ff] shadow-sm px-3.5 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="city" className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  placeholder="San Francisco"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-11 rounded-lg bg-white border border-[#e2e7ff] shadow-sm px-3.5 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="state" className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                  State
                </label>
                <input
                  id="state"
                  type="text"
                  placeholder="CA"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-11 rounded-lg bg-white border border-[#e2e7ff] shadow-sm px-3.5 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="zipCode" className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                  Zip Code
                </label>
                <input
                  id="zipCode"
                  type="text"
                  placeholder="94103"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className="w-full h-11 rounded-lg bg-white border border-[#e2e7ff] shadow-sm px-3.5 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="country" className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                  Country
                </label>
                <input
                  id="country"
                  type="text"
                  placeholder="United States"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-11 rounded-lg bg-white border border-[#e2e7ff] shadow-sm px-3.5 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-medium tracking-wide uppercase text-[#464555]">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 rounded-lg bg-white border border-[#e2e7ff] shadow-sm pl-3.5 pr-11 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
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

              {password && (
                <div className="bg-[#f2f3ff] rounded-lg px-3 pt-4 pb-3 mt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[#464555]">Security strength</span>
                    <span className="flex items-center gap-1 text-xs font-bold" style={{ color: strengthColor }}>
                      <span className="size-2 rounded-full" style={{ background: strengthColor }} />
                      {strengthLabel}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#e2e7ff] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(checksPassed / 3) * 100}%`, background: strengthColor }}
                    />
                  </div>
                  <div className="flex gap-4 pt-2 flex-wrap">
                    {[
                      { key: 'length', label: '8+ chars' },
                      { key: 'number', label: '1+ number' },
                      { key: 'uppercase', label: 'Uppercase' },
                    ].map((item) => (
                      <span
                        key={item.key}
                        className={`flex items-center gap-1 text-xs font-medium ${
                          checks[item.key] ? 'text-[#006c49]' : 'text-[#9694a8]'
                        }`}
                      >
                        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="8" cy="8" r="7" />
                          {checks[item.key] && <path d="M5 8.2 7.2 10.4 11.2 5.8" />}
                        </svg>
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 pt-1 cursor-pointer select-none">
              <span
                className={`mt-0.5 size-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                  agreed ? 'bg-[#3525cd]' : 'bg-[#e2e7ff]'
                }`}
              >
                {agreed && (
                  <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none" stroke="white" strokeWidth="1.5">
                    <path d="M1 4l3 3 5-6" />
                  </svg>
                )}
              </span>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="sr-only" />
              <span className="text-xs text-[#464555]">
                I agree to the <a href="#" className="font-medium text-[#3525cd] hover:underline">Terms of Service</a> and{' '}
                <a href="#" className="font-medium text-[#3525cd] hover:underline">Privacy Policy</a>.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="h-11 mt-1 flex items-center justify-center gap-2 rounded-lg bg-[#3525cd] text-white text-base font-semibold shadow-[0_10px_15px_-3px_rgba(53,37,205,0.25),0_4px_6px_-4px_rgba(53,37,205,0.25)] hover:bg-[#2c1fb0] transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Your Billflow Account'}
              {!loading && (
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="relative flex items-center justify-between border-t border-[#e2e7ff] pt-5 mt-6 flex-wrap gap-2">
            <p className="text-sm text-[#464555]">
              {'Already have an account? '}
              <Link to="/login" className="font-semibold text-[#3525cd] hover:underline">
                Log in
              </Link>
            </p>
            <span className="flex items-center gap-1 text-xs text-[#777587]">
              <svg viewBox="0 0 12 14" className="size-3" fill="none" stroke="#777587" strokeWidth="1.2">
                <path d="M6 1 1 3v4c0 3 2.2 4.8 5 6 2.8-1.2 5-3 5-6V3L6 1Z" />
              </svg>
              256-bit SSL secured
            </span>
          </div>
        </div>

        {/* Right column: product showcase */}
        <div className="lg:col-span-5 flex flex-col gap-6 pt-4">
          {/* Invoice mockup */}
          <div className="bg-white rounded-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#ba1a1a]" />
                <span className="size-2.5 rounded-full bg-[#ffb95f]" />
                <span className="size-2.5 rounded-full bg-[#4edea3]" />
                <span className="text-xs font-medium text-[#777587] ml-2">INV-2024-0089</span>
              </div>
              <span className="text-xs font-semibold text-[#00714d] bg-[#6cf8bb]/30 rounded-full px-2.5 py-0.5">
                ● Ready to Send
              </span>
            </div>

            <div className="bg-[#f2f3ff] rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium tracking-wide uppercase text-[#777587]">Billed To</p>
                  <p className="text-base font-semibold text-[#131b2e]">Acme Global Ltd.</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium tracking-wide uppercase text-[#777587]">Amount Due</p>
                  <p className="text-lg font-bold text-[#3525cd]">$4,850.00</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#464555]">
                🕐 Net 15 days · Due Dec 15
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#e2e7ff] py-1.5">
                <span className="text-xs font-medium text-[#131b2e]">Design System Implementation</span>
                <span className="text-xs font-bold text-[#131b2e]">$3,200.00</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#e2e7ff] py-1.5">
                <span className="text-xs font-medium text-[#131b2e]">User Research & Flow Audits</span>
                <span className="text-xs font-bold text-[#131b2e]">$1,650.00</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white rounded-lg p-3">
              <div>
                <p className="text-xs font-medium text-[#777587]">Cashflow Velocity</p>
                <p className="text-sm font-bold text-[#006c49]">+28.4% this month</p>
              </div>
              <svg viewBox="0 0 112 32" className="w-28 h-8">
                <polyline
                  points="0,26 16,22 32,24 48,14 64,18 80,8 96,10 112,2"
                  fill="none"
                  stroke="#006c49"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Benefit chips */}
          <div className="flex flex-col gap-3">
            {[
              { bg: 'bg-[#6ffbbe]/50', icon: '🧾', title: 'Unlimited invoices', body: 'Send as many PDF or web invoices as you need with 0 limits.' },
              { bg: 'bg-[#e2dfff]', icon: '⏰', title: 'Automated reminders', body: 'Intelligent recurring chasers that recover debts 3x faster.' },
              { bg: 'bg-[#ffddb8]', icon: '💳', title: 'Stripe & PayPal integration', body: 'Instant 1-click checkout with cards, Apple Pay, SEPA, and wire.' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3.5">
                <div className={`size-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${item.bg}`}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-base font-semibold text-[#131b2e]">{item.title}</p>
                  <p className="text-xs text-[#464555]">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="bg-[#f2f3ff] rounded-xl p-4 flex items-center gap-4">
            <div className="size-12 rounded-full bg-gradient-to-br from-[#4f46e5] to-[#3525cd] shrink-0 shadow-sm" />
            <div>
              <p className="italic text-xs text-[#131b2e]">
                "Billflow cut our unpaid invoices down to near zero within 30 days."
              </p>
              <p className="text-xs font-medium text-[#777587] mt-1">
                — Elena Vance, Principal at Forma Labs
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}