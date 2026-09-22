import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { formatMoney, symbolFor } from '../lib/currency';

// Public "Pay now" page — opened from the payment link in the invoice email.
// No login required: the unguessable URL token identifies the invoice.
//
// Payment path:
//   1. Pay with eSewa (primary) — server books a payment, we redirect to
//      eSewa (app on mobile, ePay web on desktop); when the client returns,
//      this page resolves the booking and shows the result.
//   2. Demo checkout (fallback) — simulated card form, records test payments.

function formatCardNumber(v) {
  const d = v.replace(/\D/g, '').slice(0, 19);
  return d.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(v) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length >= 3) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

function cardBrand(v) {
  const d = v.replace(/\D/g, '');
  if (/^4/.test(d)) return { name: 'Visa', color: '#1a1f71' };
  if (/^(5[1-5]|2[2-7])/.test(d)) return { name: 'Mastercard', color: '#eb001b' };
  if (/^3[47]/.test(d)) return { name: 'Amex', color: '#2e77bc' };
  return null;
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function PaymentLink() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const attemptParam = searchParams.get('attempt');

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Amount + gateway
  const [amount, setAmount] = useState('');
  const [startingEsewa, setStartingEsewa] = useState(false);
  const [esewaError, setEsewaError] = useState('');

  // Redirect-back resolution (after eSewa)
  const resolvedAttempt = useRef(null);
  const [resolving, setResolving] = useState(false);
  const [resolveResult, setResolveResult] = useState(null); // { status, message }

  // Demo card fallback
  const [demoOpen, setDemoOpen] = useState(false);
  const [holder, setHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [paying, setPaying] = useState(false);
  const [cardError, setCardError] = useState('');

  const [success, setSuccess] = useState(null);

  useEffect(() => {
    api.getPaymentLink(token)
      .then((data) => {
        setInvoice(data);
        setAmount(String(data.remaining || 0));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  // After eSewa redirects the client back (?attempt=...), resolve the booking.
  useEffect(() => {
    if (!invoice || !attemptParam || resolvedAttempt.current === attemptParam) return;
    resolvedAttempt.current = attemptParam;
    setResolving(true);
    api.resolvePayLink(token, attemptParam)
      .then((res) => {
        if (res.ok) setSuccess(res.invoice);
        else setResolveResult({ status: res.status || 'NOT-COMPLETED', message: res.message });
      })
      .catch((err) => setResolveResult({ status: 'ERROR', message: err.message }))
      .finally(() => setResolving(false));
  }, [invoice, attemptParam, token]);

  const brand = useMemo(() => cardBrand(cardNumber), [cardNumber]);
  const sym = symbolFor(invoice?.currency);

  function handleEsewaPay(e) {
    e.preventDefault();
    if (!invoice) return;
    const value = Number(amount);
    if (!value || value <= 0) return setEsewaError('Enter an amount to pay.');
    if (value > invoice.remaining) return setEsewaError(`Don't pay more than the remaining balance of ${formatMoney(invoice.remaining, invoice.currency)}.`);

    setEsewaError('');
    setStartingEsewa(true);
    api.initiatePayLink(token, { amount: value, gateway: 'esewa' })
      .then((res) => {
        // Hand the client to eSewa's checkout (app deeplink on mobile, ePay web on desktop).
        window.location.href = res.paymentUrl;
        setStartingEsewa(false);
      })
      .catch((err) => {
        setEsewaError(err.message);
        setStartingEsewa(false);
      });
  }

  function handleDemoPay(e) {
    e.preventDefault();
    if (!invoice) return;
    const value = Number(amount);
    if (!value || value <= 0) return setCardError('Enter an amount to pay.');
    if (value > invoice.remaining) return setCardError(`Don't pay more than the remaining balance of ${formatMoney(invoice.remaining, invoice.currency)}.`);

    setCardError('');
    setPaying(true);
    api.payInvoice(token, {
      amount: value,
      holderName: holder,
      cardNumber: cardNumber.replace(/\s+/g, ''),
      expiry,
      cvv
    })
      .then((res) => setSuccess(res.invoice))
      .catch((err) => setCardError(err.message))
      .finally(() => setPaying(false));
  }

  function useDemoCard() {
    setHolder('Demo Customer');
    setCardNumber('4111 1111 1111 1111');
    setExpiry('12/29');
    setCvv('123');
    setCardError('');
  }

  const inputCls = 'w-full bg-[#f2f3ff] border border-transparent focus:border-[#4f46e5] focus:bg-white outline-none rounded-xl px-3.5 py-2.5 text-[15px] text-[#131b2e] placeholder-[#a5a2bd] transition-colors';

  // ------------------------------ loading ------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff]">
        <div className="w-8 h-8 border-[3px] border-[#e2e7ff] border-t-[#4f46e5] rounded-full animate-spin" />
      </div>
    );
  }

  // ------------------------------ invalid link ------------------------------
  if (notFound || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff] px-4 py-8">
        <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#f2f3ff] flex items-center justify-center mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#464555" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" strokeLinecap="round" />
              <circle cx="12" cy="16.5" r="0.5" fill="#464555" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-[#131b2e] mb-1">This payment link isn't valid</h1>
          <p className="text-sm text-[#777587] mb-6 leading-relaxed">
            The link may have expired or the invoice no longer exists. Ask the sender for a fresh link.
          </p>
          <Link to="/" className="inline-block bg-[#4f46e5] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#4338ca] transition-colors">
            Go to Billflow
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------ already paid ------------------------------
  if (invoice.alreadyPaid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff] px-4 py-8">
        <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#dff6e9] flex items-center justify-center mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0e7a41" strokeWidth="2.4" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-[#0e7a41] mb-1">PAYMENT COMPLETE</p>
          <h1 className="text-xl font-bold text-[#131b2e] mb-1">All settled for this invoice</h1>
          <p className="text-sm text-[#777587] mb-6 leading-relaxed">
            Invoice <span className="font-mono font-semibold text-[#131b2e]">#{invoice.invoiceNumber}</span> from{' '}
            <span className="font-semibold text-[#131b2e]">{invoice.businessName}</span> has been fully paid.
          </p>
          <Link to="/" className="inline-block bg-[#4f46e5] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#4338ca] transition-colors">
            Back to Billflow
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------ success ------------------------------
  if (success) {
    const fullySettled = success.remaining <= 0;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff] px-4 py-8">
        <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#dff6e9] flex items-center justify-center mb-5">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0e7a41" strokeWidth="2.4" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-[#0e7a41] mb-1">PAYMENT RECEIVED</p>
          <h1 className="text-xl font-bold text-[#131b2e] mb-1">Thank you{invoice.clientName ? `, ${invoice.clientName.split(' ')[0]}` : ''}!</h1>
          <p className="text-sm text-[#777587] mb-5 leading-relaxed">
            You paid <span className="font-mono font-bold text-[#131b2e]">{formatMoney(success.amountPaid, invoice.currency)}</span> toward invoice{' '}
            <span className="font-mono font-semibold text-[#131b2e]">#{success.invoiceNumber}</span>.
          </p>
          {fullySettled ? (
            <div className="bg-[#f3faf7] rounded-xl py-2.5 text-sm font-semibold text-[#0e7a41] mb-6">Fully settled — nothing left to pay. 🎉</div>
          ) : (
            <div className="bg-[#f2f3ff] rounded-xl py-2.5 text-sm text-[#464555] mb-6">
              <span className="font-semibold text-[#3525cd]">{formatMoney(success.remaining, invoice.currency)}</span> still outstanding — a receipt is on its way.
            </div>
          )}
          <Link to="/" className="inline-block bg-[#4f46e5] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#4338ca] transition-colors">
            Back to Billflow
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------ pay form ------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8ff] px-4 py-8">
      <div className="w-full max-w-[460px]">
        <div className="flex items-center justify-center gap-1.5 mb-5 text-xs text-[#777587]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#777587" strokeWidth="2" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          Secure payment · no account needed
        </div>

        <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-7">
          {/* Business + invoice header */}
          <div className="flex items-start justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#4f46e5] text-white flex items-center justify-center font-bold text-sm shrink-0">
                {initials(invoice.businessName)}
              </div>
              <div>
                <p className="font-bold text-[#131b2e] leading-tight">{invoice.businessName}</p>
                <p className="text-xs text-[#464555]">Invoice <span className="font-mono font-semibold">#{invoice.invoiceNumber}</span></p>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#fff4e0] text-[#a05c00] shrink-0">
              {invoice.status === 'partially_paid' ? 'Partial payment' : 'Due now'}
            </span>
          </div>

          {/* Amount due */}
          <div className="bg-[#f2f3ff] rounded-xl p-5 mb-5">
            <p className="text-[11px] font-semibold tracking-wide uppercase text-[#464555] mb-1">Amount due now</p>
            <p className="text-3xl font-mono font-bold tracking-[-0.7px] text-[#131b2e]">{formatMoney(invoice.remaining, invoice.currency)}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#e2e7ff] text-xs text-[#464555]">
              <span>Invoice total</span>
              <span className="font-mono">{formatMoney(invoice.total, invoice.currency)}</span>
            </div>
            {invoice.paid > 0 && (
              <div className="flex items-center justify-between mt-1 text-xs text-[#464555]">
                <span>Already paid</span>
                <span className="font-mono text-[#0e7a41]">− {formatMoney(invoice.paid, invoice.currency)}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-1 text-xs text-[#464555]">
              <span>Due date</span>
              <span className="font-mono">
                {new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Resolve result (after returning from eSewa) */}
          {resolving && (
            <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-[#f2f3ff] px-4 py-3 text-sm text-[#464555]">
              <span className="w-4 h-4 border-2 border-[#e2e7ff] border-t-[#4f46e5] rounded-full animate-spin" />
              Confirming your payment…
            </div>
          )}
          {!resolving && resolveResult && (
            <div className="mb-4 rounded-xl bg-[#fff8ee] border border-[#ffdfae] px-4 py-3 text-[13px] text-[#965d00] font-medium leading-relaxed">
              {resolveResult.message}
              <button
                type="button"
                onClick={() => {
                  setResolveResult(null);
                  resolvedAttempt.current = null;
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                className="block mt-1.5 text-[#0e7a41] font-semibold hover:underline"
              >
                Start payment again →
              </button>
            </div>
          )}

          {/* Pay with eSewa */}
          <form onSubmit={handleEsewaPay} noValidate>
            <label className="block mb-4">
              <span className="flex items-center justify-between text-xs font-semibold text-[#464555] mb-1.5">
                <span>Amount to pay</span>
                {Number(amount) !== invoice.remaining && (
                  <button type="button" onClick={() => setAmount(String(invoice.remaining))} className="text-[#4f46e5] hover:underline font-semibold">
                    Pay full amount
                  </button>
                )}
              </span>
              <span className="relative block">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-[#464555] font-mono">{sym}</span>
                <input
                  className={`${inputCls} font-mono pl-8`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
                  inputMode="decimal"
                  required
                />
              </span>
            </label>

            {esewaError && (
              <div className="mb-4 rounded-xl bg-[#fff1f0] border border-[#ffd3cf] px-4 py-3 text-[13px] text-[#ba1a1a] font-medium">
                {esewaError}
              </div>
            )}

            <button
              type="submit"
              disabled={startingEsewa || resolving}
              className="w-full flex items-center justify-center gap-2.5 bg-[#1287d1] hover:bg-[#0e74b8] disabled:opacity-50 text-white font-semibold text-[15px] py-3 rounded-xl transition-colors"
            >
              {startingEsewa && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {startingEsewa ? 'Redirecting to eSewa…' : (
                <>
                  <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">e</span>
                  Pay {formatMoney(Number(amount) || 0, invoice.currency)} with eSewa
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-[#a5a2bd]">
              eSewa wallet · mobile banking · cards — in test mode, no real charge yet
            </p>
          </form>

          {/* Demo checkout fallback */}
          <div className="mt-5 pt-5 border-t border-[#eeeeff]">
            {!demoOpen ? (
              <button
                type="button"
                onClick={() => setDemoOpen(true)}
                className="w-full text-center text-xs text-[#777587] hover:text-[#464555] transition-colors"
              >
                No eSewa? Pay with the demo checkout instead (no real charge) →
              </button>
            ) : (
              <form onSubmit={handleDemoPay} noValidate>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className="col-span-2 block">
                    <span className="block text-xs font-semibold text-[#464555] mb-1.5">Cardholder name</span>
                    <input className={inputCls} value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Name on card" autoComplete="cc-name" required />
                  </label>
                  <label className="col-span-2 block">
                    <span className="block text-xs font-semibold text-[#464555] mb-1.5">Card number</span>
                    <span className="relative block">
                      <input
                        className={`${inputCls} font-mono pr-12`}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="1234 5678 9012 3456"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        required
                      />
                      {brand && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-wide" style={{ color: brand.color }}>
                          {brand.name.toUpperCase()}
                        </span>
                      )}
                    </span>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-[#464555] mb-1.5">Expiry</span>
                    <input
                      className={`${inputCls} font-mono`}
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-[#464555] mb-1.5">CVV</span>
                    <input
                      className={`${inputCls} font-mono`}
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      required
                    />
                  </label>
                </div>

                {cardError && (
                  <div className="mb-4 rounded-xl bg-[#fff1f0] border border-[#ffd3cf] px-4 py-3 text-[13px] text-[#ba1a1a] font-medium">
                    {cardError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={paying}
                  className="w-full flex items-center justify-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 text-white font-semibold text-[15px] py-3 rounded-xl transition-colors"
                >
                  {paying && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  {paying ? 'Processing…' : 'Pay (demo checkout)'}
                </button>

                <button type="button" onClick={useDemoCard} className="mt-2 w-full text-center text-xs text-[#777587] hover:text-[#464555] transition-colors">
                  Use the demo card →
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center mt-5 text-xs text-[#a5a2bd]">
          Demo checkout — no real charge is made · Powered by <span className="font-semibold text-[#777587]">Billflow</span>
        </p>
      </div>
    </div>
  );
}