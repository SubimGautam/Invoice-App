import { Link } from 'react-router-dom';

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
        <span className="text-white text-sm font-bold">B</span>
      </div>
      <span className="text-lg font-semibold text-gray-900">Billflow</span>
    </div>
  );
}

function Nav() {
  return (
    <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
      <div className="flex items-center gap-10">
        <Logo />
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
          <a href="#product" className="hover:text-gray-900 transition-colors">Product</a>
          <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
          <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
          <a href="#testimonials" className="hover:text-gray-900 transition-colors">Testimonials</a>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/login"
          className="text-sm text-gray-700 hover:text-gray-900 transition-colors px-3 py-2"
        >
          Sign In
        </Link>
        <Link
          to="/signup"
          className="text-sm bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-full font-medium transition-colors"
        >
          Start Free
        </Link>
      </div>
    </nav>
  );
}

function InvoicePreview() {
  return (
    <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-w-lg w-full">
      <div className="absolute -top-4 -left-4 bg-white rounded-xl shadow-md border border-gray-100 px-4 py-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <div>
          <p className="text-[11px] text-gray-500 leading-none">Payment Received</p>
          <p className="text-sm font-semibold text-green-600 leading-tight">+$4,850.00</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 pt-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">Invoice #BF-2025-084</p>
          <p className="text-xs text-gray-500">Issued Mar 14, 2025 · Due Mar 28, 2025</p>
        </div>
        <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">
          PAID
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-100 text-xs">
        <div>
          <p className="text-gray-400 mb-1">FROM</p>
          <p className="font-medium text-gray-800">Studio Nexus Inc.</p>
          <p className="text-gray-500">billing@nexusdesign.io</p>
        </div>
        <div>
          <p className="text-gray-400 mb-1">BILLED TO</p>
          <p className="font-medium text-gray-800">Acme Global Technologies</p>
          <p className="text-gray-500">ap@acmeglobal.com</p>
        </div>
      </div>

      <div className="py-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-700">Design System Architecture & Token Pipeline</span>
          <span className="font-medium text-gray-900">$3,000.00</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-700">Fintech Dashboard Front-End</span>
          <span className="font-medium text-gray-900">$1,500.00</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-700">Cloud Hosting & Webhook Sync</span>
          <span className="font-medium text-gray-900">$350.00</span>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-900">Total Paid</span>
        <span className="text-lg font-bold text-gray-900">$4,850.00</span>
      </div>
    </div>
  );
}

function TrustedBy() {
  const names = ['VERTEX', 'KINETIC', 'PULSEFLOW', 'SYNTH', 'BASELINE'];
  return (
    <div className="border-y border-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-xs tracking-wide text-gray-400 mb-6">
          Trusted by growing teams, creators, and fast-moving tech companies
        </p>
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-3">
          {names.map((name) => (
            <span key={name} className="text-sm font-semibold text-gray-300">
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ badge, badgeColor, title, description, stat, statLabel }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-shadow">
      <span
        className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-4 ${badgeColor}`}
      >
        {badge}
      </span>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed mb-5">{description}</p>
      <div className="flex items-baseline justify-between pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-400">{statLabel}</span>
        <span className="text-sm font-semibold text-gray-900">{stat}</span>
      </div>
    </div>
  );
}

function Features() {
  return (
    <div id="features" className="max-w-6xl mx-auto px-6 py-20">
      <div className="text-center mb-14">
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          Everything you need to invoice effortlessly
        </h2>
        <p className="text-gray-500 max-w-xl mx-auto">
          Skip the manual spreadsheets and outdated PDF editors — Billflow runs as
          your invoicing desk, around the clock.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <FeatureCard
          badge="Instant Dispatch"
          badgeColor="bg-blue-50 text-blue-600"
          title="1-Click Invoicing"
          description="Turn contracts, milestones, or tracked time into a polished, on-brand invoice in seconds. Supports 135+ currencies."
          statLabel="Time to create invoice"
          stat="< 45 seconds"
        />
        <FeatureCard
          badge="Live Audit Telemetry"
          badgeColor="bg-emerald-50 text-emerald-600"
          title="Real-Time Tracking"
          description="Know exactly when a client opens, views, downloads, or approves payment — synced straight into your records."
          statLabel="Payment speedup"
          stat="3.2x faster"
        />
        <FeatureCard
          badge="Automated Chasing"
          badgeColor="bg-violet-50 text-violet-600"
          title="Automated Follow-ups"
          description="Friendly, well-timed reminders before and after due dates, so you never have to send an awkward chase email again."
          statLabel="Unpaid overdue rate"
          stat="-68%"
        />
      </div>
    </div>
  );
}

function Calculator() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      <div className="bg-gray-50 rounded-3xl p-10 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-xs font-medium text-violet-600 mb-3">REVENUE ACCELERATION</p>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            See how much faster your receivables could clear
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Teams switching to Billflow recover an average of 14 hours a month in
            admin time, while cutting down overdue receivables.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <label className="block text-xs text-gray-400 mb-2">Monthly invoices issued</label>
          <div className="text-3xl font-bold text-gray-900 mb-6">25</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Est. hours saved</p>
              <p className="text-xl font-semibold text-gray-900">18 hrs/mo</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-emerald-600 mb-1">Accelerated cashflow</p>
              <p className="text-xl font-semibold text-emerald-700">+$12,400</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinalCTA() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20 text-center">
      <h2 className="text-3xl font-bold text-gray-900 mb-3">
        Ready to reclaim your cash flow?
      </h2>
      <p className="text-gray-500 max-w-md mx-auto mb-8">
        Set up in under 3 minutes. No commitment, no credit card required.
      </p>
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        <Link
          to="/signup"
          className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-full font-medium transition-colors"
        >
          Create My First Invoice
        </Link>
        <a
          href="#pricing"
          className="border border-gray-200 hover:border-gray-300 text-gray-700 px-6 py-3 rounded-full font-medium transition-colors"
        >
          View Simple Pricing
        </a>
      </div>
      <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-400">
        <span>SOC-2 Type II Certified</span>
        <span>256-Bit SSL Bank-Level Security</span>
        <span>GDPR & HIPAA Compliant</span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo />
        <p className="text-xs text-gray-400">© 2026 Billflow. Precision invoicing for modern finance.</p>
        <div className="flex gap-5 text-xs text-gray-400">
          <a href="#" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-gray-600 transition-colors">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      {/* Hero */}
      <div className="bg-gradient-to-b from-violet-50 via-white to-white">
        <div className="max-w-4xl mx-auto px-6 pt-14 pb-20 text-center">
          <span className="inline-block text-xs font-medium text-violet-600 bg-violet-50 px-3 py-1.5 rounded-full mb-6">
            New: Automated Payment Reminders v2.0
          </span>

          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            Effortless invoicing for{' '}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              modern businesses & freelancers
            </span>
          </h1>

          <p className="text-gray-500 max-w-xl mx-auto mb-8">
            Create, track, and get paid faster with automated invoicing, one-click
            recurring schedules, and a billing flow your clients will actually enjoy.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <Link
              to="/signup"
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-full font-medium transition-colors"
            >
              Start Free Trial
            </Link>
            <a
              href="#product"
              className="border border-gray-200 hover:border-gray-300 text-gray-700 px-6 py-3 rounded-full font-medium transition-colors"
            >
              Watch 2-min Demo
            </a>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-gray-400 mb-16">
            <span>No credit card required</span>
            <span>14-day full access</span>
            <span>Cancel anytime</span>
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