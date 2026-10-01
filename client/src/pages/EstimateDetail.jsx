import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { ChevronRightIcon, CheckCircleIcon, XCircleIcon, ConvertIcon, LinkIcon, EyeIcon } from '../components/Icons';
import EstimateStatusPill from '../components/EstimateStatusPill';
import { isExpired, estimateStatusLabel } from '../components/estimateStatus';
import { formatMoney } from '../lib/currency';
import { computeTotals, lineAmount } from '../lib/money';

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canWrite } = useAuth();

  const [estimate, setEstimate] = useState(null);
  const [settings, setSettings] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  // Two-step send, same reasoning as the invoice's "Email Invoice": emailing a
  // quote is the moment the client is committed to seeing it, so it deserves a
  // deliberate click rather than firing on the first one.
  const [confirmSend, setConfirmSend] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Reload after an action (send / status change). Deliberately does NOT touch
  // `loading`: the page already has data, and the button that triggered it shows
  // its own busy state — a full-page spinner here would just flash.
  async function load() {
    setError('');
    try {
      const data = await api.getEstimate(id);
      setEstimate(data);
    } catch (err) {
      setError(err.message);
    }
  }

  // Initial fetch. `loading` starts true, so it only has to be cleared when the
  // request settles (and only if we're still mounted) — setting state
  // synchronously in the effect body would force a second render for nothing.
  useEffect(() => {
    let cancelled = false;
    api.getEstimate(id)
      .then((data) => {
        if (!cancelled) setEstimate(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    api.getSettings().then((s) => !cancelled && setSettings(s)).catch(() => {});
    api.getProfile().then((p) => !cancelled && setProfile(p)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Client address lines for the "billed to" block on the quote.
  const clientAddress = useMemo(() => {
    if (!estimate?.client) return [];
    const c = estimate.client;
    return [
      c.companyName && c.companyName !== c.name ? c.companyName : null,
      c.name,
      c.street,
      [c.city, c.state].filter(Boolean).join(', '),
      [c.zipCode, c.country].filter(Boolean).join(' ')
    ].filter(Boolean);
  }, [estimate]);

  async function handleSendClick() {
    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }
    setConfirmSend(false);
    setBusy('send');
    setError('');
    setNotice('');
    try {
      const res = await api.sendEstimateEmail(estimate.id);
      setNotice(res.message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function handleCopyLink() {
    setBusy('link');
    setError('');
    try {
      const { url } = await api.getEstimateLink(estimate.id);
      await navigator.clipboard.writeText(url);
      setNotice(`Public link copied — send it to ${estimate.client.name} any way you like.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function handleStatus(status, reason) {
    setBusy('status');
    setError('');
    setNotice('');
    try {
      await api.updateEstimateStatus(estimate.id, status, reason);
      setDeclineOpen(false);
      setDeclineReason('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function handleConvert() {
    if (!window.confirm('Convert this estimate to an invoice? It copies the exact line items, prices and discount, and the estimate becomes read-only.')) return;
    setBusy('convert');
    setError('');
    try {
      const invoice = await api.convertEstimate(estimate.id);
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-10 text-center text-sm text-[#464555]">Loading estimate…</div>
      </DashboardLayout>
    );
  }

  if (error && !estimate) {
    return (
      <DashboardLayout>
        <div className="py-10 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <Link to="/estimates" className="mt-3 inline-block text-sm font-semibold text-[#3525cd] hover:underline">
            Back to estimates
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  if (!estimate) return null;

  const currency = settings?.currency;
  const taxRate = Number(settings?.defaultTaxRate || 0);
  // Exact money math, matching server/lib/money.js and the invoice pages. This
  // is a quote a client accepts and may convert to an invoice, so the figure
  // has to be the same cents the server computes from the same line items.
  const { subtotal, discount, tax, total } = computeTotals(estimate, taxRate);
  const locked = estimate.status === 'converted';
  const expired = estimate.status === 'sent' && isExpired(estimate);
  // Converting is only meaningful once the client has the quote. A draft has
  // not been sent, and a decline is an explicit "no" — both are refused by the
  // server, so don't offer a button that can only fail.
  const canConvert = estimate.status === 'accepted' || estimate.status === 'sent';

  return (
    <DashboardLayout>
      <div className="py-4">
        <div className="flex items-center gap-1">
          <Link to="/estimates" className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555] hover:underline">
            Estimates
          </Link>
          <ChevronRightIcon className="w-1.5 h-2 opacity-50" />
          <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">{estimate.estimateNumber}</span>
        </div>

        {notice && <div className="mt-4 bg-[#f2f3ff] text-[#3525cd] text-sm px-4 py-3 rounded-xl">{notice}</div>}
        {error && <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

        <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] font-mono">{estimate.estimateNumber}</h1>
            <EstimateStatusPill status={estimate.status} />
            {expired && (
              <span className="text-xs font-semibold text-[#ba1a1a] bg-red-50 px-2 py-0.5 rounded-full">Expired</span>
            )}
          </div>

          {canWrite && (
            <div className="flex items-center gap-2 flex-wrap">
              {!locked && (
                <>
                  <button
                    onClick={handleCopyLink}
                    disabled={busy === 'link'}
                    className="inline-flex items-center gap-1.5 bg-white border border-[#dcdbff] text-[#3525cd] text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#f2f3ff] transition-colors disabled:opacity-50"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    {busy === 'link' ? 'Copying…' : 'Copy Link'}
                  </button>
                  <button
                    onClick={handleSendClick}
                    disabled={busy === 'send'}
                    className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 ${
                      confirmSend ? 'bg-[#ba1a1a] text-white hover:bg-[#a01818]' : 'bg-white border border-[#dcdbff] text-[#3525cd] hover:bg-[#f2f3ff]'
                    }`}
                  >
                    {busy === 'send' ? 'Sending…' : confirmSend ? 'Confirm send to client?' : estimate.sentAt ? 'Email Again' : 'Email Estimate'}
                  </button>
                  {confirmSend && (
                    <button onClick={() => setConfirmSend(false)} className="text-xs font-semibold text-[#464555] hover:underline">
                      Cancel
                    </button>
                  )}
                </>
              )}
              {locked && estimate.invoice && (
                <Link
                  to={`/invoices/${estimate.invoice.id}`}
                  className="inline-flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  <ConvertIcon className="w-3.5 h-3.5" />
                  View Invoice {estimate.invoice.invoiceNumber}
                </Link>
              )}
              {!locked && canConvert && !estimate.invoice && (
                <button
                  onClick={handleConvert}
                  disabled={busy === 'convert'}
                  className="inline-flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  <ConvertIcon className="w-3.5 h-3.5" />
                  {busy === 'convert' ? 'Converting…' : 'Convert to Invoice'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* The quote document */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#4f46e5] text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {initials(profile?.businessName)}
                  </div>
                  <div>
                    <p className="font-bold text-[#131b2e] leading-tight">{profile?.businessName || 'Billflow'}</p>
                    <p className="text-xs text-[#464555]">Estimate</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#464555]">Estimate total</p>
                  <p className="text-2xl font-mono font-bold tracking-[-0.6px] text-[#131b2e]">{formatMoney(total, currency)}</p>
                  <p className="text-[11px] text-[#777587] mt-0.5">Valid until {fmtDate(estimate.validUntil)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mt-6 pt-5 border-t border-[#e2e7ff]">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.6px] uppercase text-[#464555] mb-1.5">Prepared for</p>
                  <p className="font-semibold text-[#131b2e]">{estimate.client?.name}</p>
                  {clientAddress.slice(1).map((line, i) => (
                    <p key={i} className="text-xs text-[#464555]">{line}</p>
                  ))}
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.6px] uppercase text-[#464555] mb-1.5">Details</p>
                  <p className="text-xs text-[#464555]">Issued {fmtDate(estimate.issueDate)}</p>
                  <p className="text-xs text-[#464555]">Valid until {fmtDate(estimate.validUntil)}</p>
                  {estimate.sentAt && <p className="text-xs text-[#464555]">Sent {fmtDate(estimate.sentAt)}</p>}
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-[#e2e7ff]">
                      <th className="text-left text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] py-2">Description</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] py-2">Qty</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] py-2">Price</th>
                      <th className="text-right text-[11px] font-semibold font-mono tracking-[0.6px] uppercase text-[#464555] py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.items.map((it) => (
                      <tr key={it.id} className="border-b border-gray-50">
                        <td className="py-3 text-[#131b2e]">{it.description}</td>
                        <td className="py-3 text-right font-mono text-[#464555]">{String(it.quantity)}</td>
                        <td className="py-3 text-right font-mono text-[#464555]">{formatMoney(it.unitPrice, currency)}</td>
                        <td className="py-3 text-right font-mono text-[#131b2e] font-semibold">
                          {formatMoney(lineAmount(it), currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-4">
                <div className="w-full sm:w-64 flex flex-col gap-1.5 text-sm">
                  <div className="flex items-center justify-between text-[#464555]">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatMoney(subtotal, currency)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex items-center justify-between text-[#464555]">
                      <span>Discount</span>
                      <span className="font-mono">− {formatMoney(discount, currency)}</span>
                    </div>
                  )}
                  {taxRate > 0 && (
                    <div className="flex items-center justify-between text-[#464555]">
                      <span>Tax ({taxRate}%)</span>
                      <span className="font-mono">{formatMoney(tax, currency)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between font-bold text-[#131b2e] pt-1.5 border-t border-[#e2e7ff]">
                    <span>Total</span>
                    <span className="font-mono">{formatMoney(total, currency)}</span>
                  </div>
                </div>
              </div>

              {estimate.notes && (
                <div className="mt-6 pt-4 border-t border-[#e2e7ff]">
                  <p className="text-[11px] font-semibold tracking-[0.6px] uppercase text-[#464555] mb-1.5">Notes</p>
                  <p className="text-sm text-[#464555] whitespace-pre-line">{estimate.notes}</p>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-[#c7c4d8]/30 text-xs text-[#464555] flex items-center justify-between flex-wrap gap-2">
                <span>{profile?.taxNumber ? `Tax ID: ${profile.taxNumber}` : ''}</span>
                <span>This is an estimate — no payment is due until an invoice is issued.</span>
              </div>
            </div>

            {/* History */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-[#131b2e] mb-4">Activity</h3>
              {estimate.auditLogs?.length ? (
                <div className="flex flex-col gap-3">
                  {estimate.auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4f46e5] mt-2 shrink-0" />
                      <div>
                        <p className="text-sm text-[#131b2e]">{log.message}</p>
                        <p className="text-xs text-[#9694a8]">{fmtDateTime(log.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#464555]">Nothing yet.</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-[#131b2e] mb-4">Estimate Overview</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between bg-[#f2f3ff] rounded-xl p-3">
                  <div>
                    <p className="text-xs text-[#464555]">Status</p>
                    <p className="text-sm font-semibold text-[#131b2e]">{estimateStatusLabel(estimate.status)}</p>
                  </div>
                  <EstimateStatusPill status={estimate.status} />
                </div>

                {estimate.sentAt && (
                  <div className="flex items-center justify-between bg-[#f2f3ff] rounded-xl p-3">
                    <div>
                      <p className="text-xs text-[#464555]">Email Status</p>
                      <p className="text-sm font-semibold text-[#131b2e]">Sent {fmtDate(estimate.sentAt)}</p>
                    </div>
                  </div>
                )}

                {estimate.sentAt && (
                  <div className="flex items-center justify-between bg-[#f2f3ff] rounded-xl p-3">
                    <div>
                      <p className="text-xs text-[#464555]">Client View</p>
                      <p className="text-sm font-semibold text-[#131b2e]">
                        {estimate.viewCount > 0 ? `Viewed ${fmtDate(estimate.lastViewedAt)}` : 'Not viewed yet'}
                      </p>
                    </div>
                    {estimate.viewCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#006c49]">
                        <EyeIcon className="w-3 h-3" />
                        {estimate.viewCount} view{estimate.viewCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                )}

                <div className="flex items-center justify-between bg-[#f2f3ff] rounded-xl p-3">
                  <div>
                    <p className="text-xs text-[#464555]">Line Items</p>
                    <p className="text-sm font-semibold text-[#131b2e]">{estimate.items.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* The client's answer */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-[#131b2e] mb-3">Client Response</h3>

              {estimate.status === 'accepted' && (
                <div className="rounded-xl bg-[#e5f7ee] px-4 py-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-[#0e7a41]">
                    <CheckCircleIcon className="w-4 h-4" />
                    Accepted
                  </p>
                  <p className="text-xs text-[#0e7a41]/80 mt-0.5">{fmtDateTime(estimate.acceptedAt)}</p>
                </div>
              )}

              {estimate.status === 'declined' && (
                <div className="rounded-xl bg-red-50 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-[#ba1a1a]">
                    <XCircleIcon className="w-4 h-4" />
                    Declined
                  </p>
                  <p className="text-xs text-[#ba1a1a]/80 mt-0.5">{fmtDateTime(estimate.declinedAt)}</p>
                  {estimate.declinedReason && (
                    <p className="text-xs text-[#464555] mt-2 pt-2 border-t border-red-100 leading-relaxed">“{estimate.declinedReason}”</p>
                  )}
                </div>
              )}

              {estimate.status === 'converted' && (
                <div className="rounded-xl bg-[#f2f3ff] px-4 py-3">
                  <p className="text-sm font-semibold text-[#3525cd]">Converted to an invoice</p>
                  <p className="text-xs text-[#464555] mt-0.5">
                    This quote is now read-only — the invoice is the document of record.
                  </p>
                  {estimate.invoice && (
                    <Link to={`/invoices/${estimate.invoice.id}`} className="inline-block mt-2 text-xs font-semibold text-[#3525cd] hover:underline">
                      Open {estimate.invoice.invoiceNumber}
                    </Link>
                  )}
                </div>
              )}

              {estimate.status === 'sent' && (
                <p className="text-sm text-[#464555]">
                  Waiting on {estimate.client?.name}. They can accept or decline from the public link in the email.
                  {expired && ' This quote has passed its valid-until date.'}
                </p>
              )}

              {estimate.status === 'draft' && <p className="text-sm text-[#464555]">Not sent yet — the client has not seen this quote.</p>}

              {canWrite && !locked && (
                <div className="mt-4 pt-4 border-t border-[#e2e7ff] flex flex-col gap-2">
                  <p className="text-[11px] font-semibold tracking-[0.6px] uppercase text-[#464555]">Record manually</p>
                  <p className="text-[11px] text-[#9694a8]">Use this when the client answers by phone or in person.</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStatus('accepted')}
                      disabled={busy === 'status'}
                      className="inline-flex items-center gap-1 flex-1 justify-center text-sm font-semibold text-white bg-[#006c49] hover:bg-[#005239] px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      Accepted
                    </button>
                    <button
                      onClick={() => setDeclineOpen((v) => !v)}
                      disabled={busy === 'status'}
                      className="inline-flex items-center gap-1 flex-1 justify-center text-sm font-semibold text-[#ba1a1a] bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <XCircleIcon className="w-3.5 h-3.5" />
                      Declined
                    </button>
                  </div>

                  {declineOpen && (
                    <div className="flex flex-col gap-2 mt-1">
                      <textarea
                        rows={2}
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        placeholder="Why did they decline? (optional, shown on the estimate)"
                        className="rounded-lg bg-[#f2f3ff] px-3 py-2 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] resize-none"
                      />
                      <button
                        onClick={() => handleStatus('declined', declineReason)}
                        disabled={busy === 'status'}
                        className="text-sm font-semibold text-white bg-[#ba1a1a] hover:bg-[#a01818] px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {busy === 'status' ? 'Saving…' : 'Record decline'}
                      </button>
                    </div>
                  )}

                  {estimate.status !== 'draft' && (
                    <button
                      onClick={() => handleStatus('draft')}
                      disabled={busy === 'status'}
                      className="text-xs font-semibold text-[#464555] hover:underline disabled:opacity-50 self-start"
                    >
                      Revert to draft
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
