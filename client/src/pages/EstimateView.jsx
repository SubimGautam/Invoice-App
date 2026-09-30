import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { formatMoney } from '../lib/currency';
import { CheckCircleIcon, XCircleIcon } from '../components/Icons';

// Public quote page — opened from the "Review & respond" link in the estimate
// email. No login required: the unguessable URL token identifies the quote.
//
// This is where a client's answer is actually recorded, so the accept/decline
// buttons are the primary action on the page, and the "not yet" state is
// deliberately easy to leave without deciding.

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

const inputCls =
  'w-full bg-[#f2f3ff] border border-transparent focus:border-[#4f46e5] focus:bg-white outline-none rounded-xl px-3.5 py-2.5 text-[15px] text-[#131b2e] placeholder-[#a5a2bd] transition-colors';

export default function EstimateView() {
  const { token } = useParams();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Responding
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPublicEstimate(token)
      .then(setQuote)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  async function respond(decision) {
    setBusy(decision);
    setError('');
    try {
      const res = await api.respondToEstimate(token, { decision, reason: decision === 'declined' ? reason : undefined });
      // Re-fetch so the page renders the recorded answer (and the right dates)
      // rather than guessing at local state.
      const fresh = await api.getPublicEstimate(token);
      setQuote(fresh);
      setDeclineOpen(false);
      if (res.alreadyAnswered) setError('Your response was already recorded — nothing changed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff]">
        <div className="flex items-center gap-2 text-sm text-[#464555]">
          <span className="w-4 h-4 border-2 border-[#e2e7ff] border-t-[#4f46e5] rounded-full animate-spin" />
          Loading estimate…
        </div>
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff] px-4 py-8">
        <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#f2f3ff] flex items-center justify-center mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#464555" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-[#131b2e]">Estimate not available</h1>
          <p className="mt-2 text-sm text-[#464555] leading-relaxed">
            This link is invalid or the estimate is no longer available. Check with {quote?.businessName || 'the sender'} for an
            up-to-date copy.
          </p>
        </div>
      </div>
    );
  }

  const converted = quote.status === 'converted';

  return (
    <div className="min-h-screen bg-[#faf8ff] px-4 py-8">
      <div className="w-full max-w-[640px] mx-auto">
        <div className="flex items-center justify-center gap-1.5 mb-5 text-xs text-[#777587]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#777587" strokeWidth="2" aria-hidden="true">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          No account needed
        </div>

        <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-7">
          {/* From */}
          <div className="flex items-start justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#4f46e5] text-white flex items-center justify-center font-bold text-sm shrink-0">
                {initials(quote.businessName)}
              </div>
              <div>
                <p className="font-bold text-[#131b2e] leading-tight">{quote.businessName}</p>
                <p className="text-xs text-[#464555]">
                  Estimate <span className="font-mono font-semibold">#{quote.estimateNumber}</span>
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#fff4e0] text-[#a05c00] shrink-0">
              Valid until {fmtDate(quote.validUntil)}
            </span>
          </div>

          {/* Total */}
          <div className="bg-[#f2f3ff] rounded-xl p-5 mb-5">
            <p className="text-[11px] font-semibold tracking-wide uppercase text-[#464555] mb-1">Estimated total</p>
            <p className="text-3xl font-mono font-bold tracking-[-0.7px] text-[#131b2e]">{formatMoney(quote.total, quote.currency)}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#e2e7ff] text-xs text-[#464555]">
              <span>Prepared for</span>
              <span className="font-semibold text-[#131b2e]">{quote.clientName}</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-[#464555]">
              <span>Issued</span>
              <span className="font-mono">{fmtDate(quote.issueDate)}</span>
            </div>
          </div>

          {/* Line items */}
          <div className="overflow-x-auto mb-5">
            <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b border-[#e2e7ff]">
                  <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] py-2">Item</th>
                  <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] py-2">Qty</th>
                  <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2.5 text-[#131b2e]">{it.description}</td>
                    <td className="py-2.5 text-right font-mono text-[#464555]">{it.quantity}</td>
                    <td className="py-2.5 text-right font-mono text-[#131b2e] font-semibold">{formatMoney(it.amount, quote.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {quote.discount > 0 && (
            <div className="flex items-center justify-between text-sm text-[#464555] mb-2">
              <span>Discount</span>
              <span className="font-mono">− {formatMoney(quote.discount, quote.currency)}</span>
            </div>
          )}
          <div className="flex items-center justify-between font-bold text-[#131b2e] pt-2 border-t border-[#e2e7ff]">
            <span>Total</span>
            <span className="font-mono">{formatMoney(quote.total, quote.currency)}</span>
          </div>

          {quote.notes && (
            <div className="mt-5 pt-4 border-t border-[#e2e7ff]">
              <p className="text-[11px] font-semibold tracking-[0.6px] uppercase text-[#464555] mb-1.5">Notes</p>
              <p className="text-sm text-[#464555] whitespace-pre-line leading-relaxed">{quote.notes}</p>
            </div>
          )}

          {error && <div className="mt-5 rounded-xl bg-[#fff8ee] border border-[#ffdfae] px-4 py-3 text-[13px] text-[#965d00] font-medium leading-relaxed">{error}</div>}

          {/* Response */}
          <div className="mt-6 pt-5 border-t border-[#e2e7ff]">
            {converted ? (
              <div className="rounded-xl bg-[#f2f3ff] px-4 py-3 text-sm text-[#3525cd] font-medium leading-relaxed">
                This estimate has been turned into an invoice. Please use the invoice {quote.businessName} sent you for
                payment.
              </div>
            ) : quote.status === 'accepted' ? (
              <div className="rounded-xl bg-[#e5f7ee] px-4 py-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#0e7a41]">
                  <CheckCircleIcon className="w-5 h-5" />
                  You accepted this estimate
                </p>
                <p className="text-xs text-[#0e7a41]/80 mt-1">
                  {quote.businessName} has been notified and will send you an invoice.
                </p>
              </div>
            ) : quote.status === 'declined' ? (
              <div className="rounded-xl bg-red-50 px-4 py-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[#ba1a1a]">
                  <XCircleIcon className="w-5 h-5" />
                  You declined this estimate
                </p>
                <p className="text-xs text-[#ba1a1a]/80 mt-1">{quote.businessName} has been notified.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[#464555] mb-3">
                  Happy to go ahead with this? Your answer goes straight to {quote.businessName}.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => respond('accepted')}
                    disabled={busy !== ''}
                    className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#006c49] hover:bg-[#005239] px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                    {busy === 'accepted' ? 'Sending…' : 'Accept estimate'}
                  </button>
                  <button
                    onClick={() => setDeclineOpen((v) => !v)}
                    disabled={busy !== ''}
                    className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#ba1a1a] bg-red-50 hover:bg-red-100 px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <XCircleIcon className="w-4 h-4" />
                    Decline
                  </button>
                </div>

                {declineOpen && (
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Tell them why (optional) — it helps them win the next one."
                      className={inputCls + ' resize-none text-sm'}
                    />
                    <button
                      onClick={() => respond('declined')}
                      disabled={busy !== ''}
                      className="text-sm font-semibold text-white bg-[#ba1a1a] hover:bg-[#a01818] px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {busy === 'declined' ? 'Sending…' : 'Confirm decline'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-[#777587]">
          This is an estimate, not a bill. Nothing is due until an invoice is issued.
        </p>
      </div>
    </div>
  );
}
