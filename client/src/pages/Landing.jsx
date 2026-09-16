import { Link } from 'react-router-dom';

function Logo({ light = false }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-[#3525cd] flex items-center justify-center shadow-sm">
        <span className="text-white text-sm font-bold">B</span>
      </div>
      <span className={`text-base font-bold tracking-tight ${light ? 'text-white' : 'text-[#131b2e]'}`}>
        Billflow
      </span>
    </div>
  );
}

function Nav() {
  const navLinks = [
    { label: 'Product', href: '#product', active: true },
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Testimonials', href: '#testimonials' },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#faf8ff]/90 border-b border-[#c7c4d8]/30 shadow-[0_1px_8px_0_rgba(15,23,42,0.04)]">
      <nav className="w-full flex items-center justify-between px-8 lg:px-16 h-16">
        <div className="flex items-center gap-6">
          <Logo />
          <div className="hidden md:flex items-center gap-1 text-sm">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`px-4 py-1 rounded-lg font-semibold transition-colors ${
                  link.active
                    ? 'bg-[#e2e7ff] text-[#131b2e]'
                    : 'text-[#464555] font-normal hover:text-[#131b2e]'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="text-sm font-medium text-[#464555] hover:text-[#131b2e] transition-colors px-4 py-1"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="text-sm bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-1 rounded-xl font-semibold shadow-sm transition-colors"
          >
            Start Free
          </Link>
          <div className="hidden sm:flex items-center pl-3 border-l border-[#c7c4d8]/40">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4f46e5] to-[#3525cd]" />
          </div>
        </div>
      </nav>
    </header>
  );
}

function AnnouncementBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 bg-[#dae2fd]/80 shadow-sm rounded-full px-4 py-1.5 mb-6">
      <span className="w-2 h-2 rounded-full bg-[#006c49]" />
      <span className="text-xs font-semibold tracking-wide uppercase text-[#3525cd]">
        New: Automated Payment Reminders v2.0
      </span>
    </div>
  );
}

function InvoicePreview() {
  return (
    <div className="relative bg-white rounded-2xl shadow-[0_20px_25px_-5px_rgba(77,68,227,0.05),0_8px_10px_-6px_rgba(77,68,227,0.05)] p-6 sm:p-10 w-full">
      {/* Floating chip - left */}
      <div className="hidden lg:flex absolute -left-6 top-16 items-center gap-2 bg-white rounded-xl shadow-lg px-4 py-4">
        <div className="w-10 h-10 rounded-full bg-[#6ffbbe] flex items-center justify-center">
          <span className="text-sm">💸</span>
        </div>
        <div>
          <p className="text-xs text-[#464555] leading-none mb-1">Payment Received</p>
          <p className="text-base font-bold text-[#131b2e] leading-none">+$4,850.00</p>
        </div>
        <span className="ml-2 text-xs font-semibold text-[#00714d] bg-[#6cf8bb] px-2 py-0.5 rounded-full">
          Just now
        </span>
      </div>

      {/* Floating chip - right */}
      <div className="hidden lg:flex absolute -right-6 bottom-20 items-center gap-2 bg-white rounded-xl shadow-lg px-4 py-4">
        <div className="w-10 h-10 rounded-full bg-[#e2dfff] flex items-center justify-center">
          <span className="text-sm">📨</span>
        </div>
        <div>
          <p className="text-xs text-[#464555] leading-none mb-1">Smart Follow-up</p>
          <p className="text-base font-semibold text-[#131b2e] leading-none">Delivered to client</p>
        </div>
        <span className="ml-2 text-xs font-semibold text-[#3525cd] bg-[#dae2fd] px-2 py-0.5 rounded-full">
          99.8% Open
        </span>
      </div>

      {/* Header strip */}
      <div className="bg-[#f2f3ff] rounded-xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#3525cd] shadow-sm flex items-center justify-center text-white font-bold text-sm">
            B
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-[#131b2e]">Invoice #BF-2025-084</p>
              <span className="text-xs font-semibold text-[#065f46] bg-[#ecfdf5] px-2 py-0.5 rounded-full">
                PAID
              </span>
            </div>
            <p className="text-xs text-[#464555]">Issued March 14, 2025 · Due March 28, 2025</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs font-semibold text-[#131b2e] bg-white shadow-sm px-4 py-2 rounded-lg">
            PDF
          </button>
          <button className="text-xs font-semibold text-white bg-[#3525cd] shadow-sm px-4 py-2 rounded-lg">
            Client Portal
          </button>
        </div>
      </div>

      {/* From / Billed to / Payout method */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6">
        <div className="bg-white rounded-xl p-4">
          <p className="text-xs text-[#464555] tracking-wide uppercase mb-1">From</p>
          <p className="font-bold text-[#131b2e] text-base">Studio Nexus Inc.</p>
          <p className="text-xs text-[#464555]">billing@nexusdesign.io</p>
          <p className="text-xs text-[#464555]">San Francisco, CA · VAT: US984210</p>
        </div>
        <div className="bg-white rounded-xl p-4">
          <p className="text-xs text-[#464555] tracking-wide uppercase mb-1">Billed To</p>
          <p className="font-bold text-[#131b2e] text-base">Acme Global Technologies</p>
          <p className="text-xs text-[#464555]">ap@acmeglobal.com</p>
          <p className="text-xs text-[#464555]">Austin, TX 78701</p>
        </div>
        <div className="bg-white rounded-xl p-4">
          <p className="text-xs text-[#464555] tracking-wide uppercase mb-1">Payout Method</p>
          <p className="font-semibold text-[#131b2e] text-sm">Silicon Valley Bank (••8812)</p>
          <p className="text-xs text-[#006c49] mt-1">Direct wire transfer confirmed</p>
        </div>
      </div>

      {/* Itemized table */}
      <div className="rounded-xl overflow-x-auto border border-[#e2e7ff]">
        <table className="w-full text-left">
          <thead className="bg-[#f2f3ff]">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold tracking-wide uppercase text-[#464555]">
                Description
              </th>
              <th className="px-4 py-3 text-xs font-semibold tracking-wide uppercase text-[#464555] text-center">
                Hours / Qty
              </th>
              <th className="px-4 py-3 text-xs font-semibold tracking-wide uppercase text-[#464555] text-right">
                Unit Rate
              </th>
              <th className="px-4 py-3 text-xs font-semibold tracking-wide uppercase text-[#464555] text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                title: 'Design System Architecture & Token Pipeline',
                sub: 'Figma variables sync, Tailwind config tokens, component audit',
                qty: '24.0',
                rate: '$125.00',
                amount: '$3,000.00',
              },
              {
                title: 'Fintech Dashboard Responsive Front-End',
                sub: 'Interactive analytics, dark/light contrast pass, mobile layout reflow',
                qty: '12.5',
                rate: '$120.00',
                amount: '$1,500.00',
                shaded: true,
              },
              {
                title: 'Cloud Hosting & Automated Webhook Sync Setup',
                sub: 'Stripe Connect test suites and production deployment',
                qty: '1.0',
                rate: '$350.00',
                amount: '$350.00',
              },
            ].map((row) => (
              <tr key={row.title} className={row.shaded ? 'bg-[#f2f3ff]/20' : ''}>
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-[#131b2e]">{row.title}</p>
                  <p className="text-xs text-[#464555]">{row.sub}</p>
                </td>
                <td className="px-4 py-3 text-sm text-[#464555] text-center">{row.qty}</td>
                <td className="px-4 py-3 text-sm text-[#464555] text-right">{row.rate}</td>
                <td className="px-4 py-3 text-sm font-semibold text-[#131b2e] text-right">{row.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals & timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
        <div className="bg-[#f2f3ff] rounded-xl p-4 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase text-[#464555] mb-3">
              Activity Audit Trail
            </p>
            <div className="space-y-3">
              {[
                { color: 'bg-[#006c49]', label: 'Stripe Auto-charge processed', time: 'Mar 15, 09:12 AM' },
                { color: 'bg-[#4f46e5]', label: 'Invoice opened by CFO', time: 'Mar 14, 04:30 PM' },
                { color: 'bg-[#c7c4d8]', label: 'Dispatched via SMTP relay', time: 'Mar 14, 02:10 PM' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${item.color}`} />
                  <span className="text-[#131b2e] flex-1">{item.label}</span>
                  <span className="text-[#464555]">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/60 text-xs font-medium text-[#006c49]">
            <span>🔒 256-Bit Encrypted Transaction</span>
            <span className="font-bold">TXID: #98382-SVC</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#464555]">Subtotal</span>
            <span className="text-[#131b2e] font-medium">$4,850.00</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#464555]">Tax / VAT (0.00% reverse-charge)</span>
            <span className="text-[#131b2e] font-medium">$0.00</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#464555]">Discounts</span>
            <span className="text-[#006c49] font-medium">-$0.00</span>
          </div>
          <div className="flex items-center justify-between bg-[#e2e7ff]/40 rounded-xl px-4 py-3 mt-1">
            <div>
              <p className="font-bold text-[#131b2e] text-base">Total Paid</p>
              <p className="text-xs font-semibold text-[#006c49]">Zero balance remaining</p>
            </div>
            <span className="text-2xl font-bold text-[#3525cd]">$4,850.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustedBy() {
  const names = ['VERTEX', 'KINETIC', 'PULSEFLOW', 'SYNTH', 'BASELINE'];
  return (
    <div className="bg-white py-10">
      <div className="w-full px-8 lg:px-16">
        <p className="text-center text-xs font-semibold tracking-widest text-[#464555] uppercase mb-6">
          Trusted by over 12,000+ teams, creators, & fast-growing tech companies
        </p>
        <div className="flex flex-wrap justify-center gap-x-16 gap-y-4 opacity-70">
          {names.map((name) => (
            <span key={name} className="text-base font-bold tracking-tight text-[#131b2e]">
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ badge, iconBg, icon, title, description, statLabel, stat, statColor }) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_1px_rgba(0,0,0,0.05)] p-10 flex flex-col justify-between">
      <div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-2xl ${iconBg}`}>
          {icon}
        </div>
        <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-5 bg-[#e2e7ff] text-[#464555]">
          {badge}
        </span>
        <h3 className="text-xl font-bold text-[#131b2e] mb-3">{title}</h3>
        <p className="text-sm text-[#464555] leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center justify-between bg-[#f2f3ff] rounded-xl p-4 mt-8">
        <span className="text-xs text-[#464555]">{statLabel}</span>
        <span className={`text-sm font-bold ${statColor}`}>{stat}</span>
      </div>
    </div>
  );
}

function Features() {
  return (
    <div id="features" className="w-full px-6 lg:px-16 py-16">
      <div className="text-center mb-12 max-w-2xl mx-auto">
        <p className="text-xs font-semibold tracking-widest text-[#3525cd] uppercase mb-2">
          Built for high velocities
        </p>
        <h2 className="text-3xl font-bold text-[#131b2e] mb-3">
          Everything you need to invoice effortlessly
        </h2>
        <p className="text-[#464555]">
          Ditch the manual spreadsheets and outdated PDF editors. Billflow operates as your
          dedicated 24/7 billing department.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <FeatureCard
          badge="Instant Dispatch"
          iconBg="bg-[#e2dfff]"
          icon="⚡"
          title="1-Click Invoicing"
          description="Convert contracts, milestones, or tracked timesheets into polished, brand-aligned invoices in seconds. Supports over 135+ global currencies."
          statLabel="Time to create invoice"
          stat="< 45 seconds"
          statColor="text-[#3525cd]"
        />
        <FeatureCard
          badge="Live Audit Telemetry"
          iconBg="bg-[#6ffbbe]"
          icon="📈"
          title="Real-Time Tracking"
          description="Know exactly when a client receives, views, downloads, or authorizes payment. Instant webhook callbacks feed your accounting software automatically."
          statLabel="DSO Payment Speedup"
          stat="3.2x Faster"
          statColor="text-[#006c49]"
        />
        <FeatureCard
          badge="Automated Chasing"
          iconBg="bg-[#e2e7ff]"
          icon="🛡️"
          title="Automated Follow-ups"
          description="Set intelligent cadence rules that politely remind clients before, on, and after due dates without awkward email exchanges or severed relationships."
          statLabel="Unpaid Overdue Rate"
          stat="-68% Reduction"
          statColor="text-[#684000]"
        />
      </div>
    </div>
  );
}

function Calculator() {
  return (
    <div className="w-full px-8 lg:px-16 py-6">
      <div className="bg-[#f2f3ff] rounded-3xl p-8 sm:p-10 grid md:grid-cols-2 gap-10 items-start">
        {/* ROI slider card */}
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#006c49] uppercase mb-2">
            Revenue Acceleration
          </p>
          <h2 className="text-2xl font-bold text-[#131b2e] mb-3">
            Calculate how much faster your receivables clear
          </h2>
          <p className="text-[#464555] text-sm leading-relaxed mb-6">
            Teams switching to Billflow recover an average of 14 hours per month in
            administrative chasing while eliminating overdue receivables.
          </p>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-semibold text-[#131b2e]">Monthly Invoices Issued</label>
              <span className="text-lg font-bold text-[#3525cd]">25</span>
            </div>
            <div className="h-2 rounded-full bg-[#e2e7ff] mb-4" />
            <div className="grid grid-cols-2 gap-4 bg-[#f2f3ff]/50 rounded-xl p-4">
              <div>
                <p className="text-xs text-[#464555] mb-1">Est. Hours Saved</p>
                <p className="text-xl font-bold text-[#131b2e]">18 hrs/mo</p>
              </div>
              <div>
                <p className="text-xs text-[#464555] mb-1">Accelerated Cashflow</p>
                <p className="text-xl font-bold text-[#006c49]">+$12,400</p>
              </div>
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <div id="testimonials" className="bg-white rounded-2xl shadow-md p-8 sm:p-10 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center gap-1 mb-4">
              {'★★★★★'.split('').map((s, i) => (
                <span key={i} className="text-[#f5c94a] text-sm">
                  {s}
                </span>
              ))}
              <span className="ml-2 text-xs font-bold text-[#464555]">5.0 / 5.0</span>
            </div>
            <blockquote className="italic text-[#131b2e] text-base leading-relaxed">
              “Billflow transformed our agency's cash collection. Our overdue invoices dropped
              from 35% down to under 3% within our first 60 days. The automated client reminders
              are friendly, professional, and foolproof.”
            </blockquote>
          </div>
          <div className="flex items-center gap-4 bg-[#f2f3ff]/40 rounded-xl -mx-10 -mb-10 mt-6 px-10 py-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4f46e5] to-[#3525cd] shrink-0" />
            <div>
              <p className="font-bold text-[#131b2e] text-base">Elena Rostova</p>
              <p className="text-xs text-[#464555]">Founder & Principal at Atelier Design Co.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinalCTA() {
  return (
    <div className="w-full px-8 lg:px-16 py-10">
      <div className="relative overflow-hidden bg-[#3525cd] rounded-3xl px-8 py-16 text-center">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-[#4f46e5]/40 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-[#4d44e3]/40 blur-3xl" />

        <p className="relative text-xs font-semibold tracking-widest text-[#dad7ff] uppercase mb-4">
          Ready to reclaim your cash flow?
        </p>
        <h2 className="relative text-3xl sm:text-4xl font-bold text-white max-w-2xl mx-auto mb-4">
          Start sending beautiful, automated invoices today.
        </h2>
        <p className="relative text-[#dad7ff] max-w-lg mx-auto mb-8">
          Join freelancers and companies getting paid 3x faster. Set up in under 3 minutes with
          zero commitment.
        </p>
        <div className="relative flex flex-wrap justify-center gap-4 mb-10">
          <Link
            to="/signup"
            className="bg-white hover:bg-gray-100 text-[#3525cd] px-10 py-3.5 rounded-xl font-bold shadow-lg transition-colors"
          >
            Create My First Invoice
          </Link>
          <a
            href="#pricing"
            className="bg-[#4f46e5]/60 hover:bg-[#4f46e5]/80 text-white px-6 py-3.5 rounded-xl font-medium transition-colors"
          >
            View Simple Pricing
          </a>
        </div>
        <div className="relative flex flex-wrap justify-center gap-6 text-xs text-[#dad7ff]">
          <span>SOC-2 Type II Certified</span>
          <span>256-Bit SSL Bank-Level Security</span>
          <span>GDPR & HIPAA Compliant</span>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-white border-t border-[#c7c4d8]/30 py-10">
      <div className="w-full px-8 lg:px-16 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Logo />
          <p className="text-xs text-[#464555] ml-2">
            © 2026 Billflow SaaS Inc. Precision invoicing engineered for modern finance.
          </p>
        </div>
        <div className="flex gap-6 text-xs text-[#464555]">
          <a href="#" className="hover:text-[#131b2e] transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-[#131b2e] transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-[#131b2e] transition-colors">Security</a>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#faf8ff]">
      <Nav />

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-[#e2dfff]/40 via-[#e2e7ff]/30 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute -left-40 top-80 w-96 h-96 rounded-full bg-[#6cf8bb]/20 blur-3xl pointer-events-none" />
        <div className="absolute -right-40 top-96 w-96 h-96 rounded-full bg-[#c3c0ff]/30 blur-3xl pointer-events-none" />

        <div className="relative w-full px-6 sm:px-10 lg:px-16 pt-10 pb-6 text-center">
          <AnnouncementBadge />

          <h1 className="text-4xl md:text-5xl font-extrabold text-[#131b2e] tracking-tight leading-tight mb-4">
            Effortless Invoicing for{' '}
            <span className="bg-gradient-to-r from-[#3525cd] via-[#4f46e5] to-[#4d44e3] bg-clip-text text-transparent">
              Modern Businesses & Freelancers
            </span>
          </h1>

          <p className="text-[#464555] max-w-xl mx-auto mb-10">
            Create, track, and get paid 3x faster with intelligent invoice automation, one-click
            recurring schedules, and friction-free client billing portals.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-4">
            <Link
              to="/signup"
              className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-10 py-3.5 rounded-xl font-semibold shadow-[0_10px_15px_-3px_rgba(79,70,229,0.25),0_4px_6px_-4px_rgba(79,70,229,0.25)] transition-colors flex items-center gap-2"
            >
              Start Free Trial <span aria-hidden>→</span>
            </Link>
            <a
              href="#product"
              className="bg-white hover:bg-gray-50 text-[#131b2e] px-6 py-3.5 rounded-xl font-semibold shadow-sm transition-colors flex items-center gap-2"
            >
              ▶ Watch 2-min Demo
            </a>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs font-medium text-[#464555] mb-16">
            <span>✓ No credit card required</span>
            <span>✓ 14-day full access</span>
            <span>✓ Cancel anytime</span>
          </div>

          <div id="product" className="flex justify-center">
            <InvoicePreview />
          </div>
        </div>
      </div>

      <TrustedBy />
      <Features />
      <Calculator />
      <FinalCTA />
      <Footer />
    </div>
  );
}