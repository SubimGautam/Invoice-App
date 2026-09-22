import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', NPR: 'Rs. ' };

function formatAddress(entity) {
  if (!entity) return null;
  const cityState = [entity.city, entity.state].filter(Boolean).join(', ');
  const line2 = [cityState, entity.zipCode].filter(Boolean).join(' ');
  const lines = [entity.street, line2, entity.country].filter(Boolean);
  return lines.length ? lines : null;
}

const STATUS_STYLES = {
  paid: { dot: '#006c49', text: '#006c49', bg: 'rgba(111,251,190,0.4)', label: 'Paid' },
  pending: { dot: '#684000', text: '#684000', bg: 'rgba(255,221,184,0.6)', label: 'Sent' },
  partiallyPaid: { dot: '#684000', text: '#684000', bg: 'rgba(255,234,180,0.85)', label: 'Partially Paid' },
  overdue: { dot: '#ba1a1a', text: '#ba1a1a', bg: 'rgba(255,218,214,0.4)', label: 'Overdue' },
  draft: { dot: '#777587', text: '#464555', bg: '#e2e7ff', label: 'Draft' },
};

// "Overdue" isn't a stored status — it's a sent/partially-paid invoice whose
// due date has passed. "Partially Paid" is derived from recorded payments.
function computeDisplayStatus(invoice) {
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.paid || 0);
  if (invoice.status === 'paid' || (total > 0 && paid >= total - 0.001)) return 'paid';
  if (invoice.status === 'draft') return 'draft';
  if (new Date(invoice.dueDate) < new Date()) return 'overdue';
  if (paid > 0) return 'partiallyPaid';
  return 'pending';
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function fmtDateTime(d) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function daysBetween(a, b) {
  return Math.round((new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24));
}

const ACTION_LOG_LABEL = {
  created: 'Invoice created',
  updated: 'Invoice updated',
  status_changed: 'Status changed',
  payment: 'Payment recorded',
  sent: 'Invoice emailed',
  reminder: 'Reminder sent',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Card', 'Online Payment', 'Other'];

function PaymentModal({ remaining, currencySymbol, saving, error, onClose, onSubmit }) {
  const [amount, setAmount] = useState(String(Math.max(0, Math.round(remaining * 100) / 100)));
  const [method, setMethod] = useState('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const fmt = (n) =>
    `${currencySymbol}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  function handleSubmit(e) {
    e.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) return;
    onSubmit({
      amount: value,
      method,
      paymentDate,
      reference: reference || undefined,
      notes: notes || undefined
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-[#131b2e] mb-1">Record Payment</h2>
        <p className="text-xs text-[#464555] mb-4">
          Remaining balance: <span className="font-semibold text-[#131b2e]">{fmt(remaining)}</span>
        </p>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Amount</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Date</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full h-10 rounded-lg bg-[#f2f3ff] px-2 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">
              Bank / Transaction Reference <span className="text-[#9694a8]">(optional)</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="eSewa tx ID, bank ref, cheque no..."
              className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering about this payment"
              className="rounded-lg bg-[#f2f3ff] px-3 py-2 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-[#464555] hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#006c49] hover:bg-[#00583b] transition-colors disabled:opacity-50"
            >
              {saving ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const { canWrite } = useAuth();

  const [invoice, setInvoice] = useState(null);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [inv, prof, sett, emailStatusRes] = await Promise.all([
        api.getInvoice(id),
        api.getProfile(),
        api.getSettings(),
        api.getEmailStatus(),
      ]);
      setInvoice(inv);
      setProfile(prof);
      setSettings(sett);
      setEmailStatus(emailStatusRes);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  const currencySymbol = CURRENCY_SYMBOLS[settings?.currency] || (settings?.currency ? `${settings.currency} ` : '$');

  function formatMoney(n) {
    return `${currencySymbol}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  const totals = useMemo(() => {
    if (!invoice) return { subtotal: 0, discount: 0, taxable: 0, tax: 0, total: 0, taxRate: 0, paid: 0, remaining: 0 };
    const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
    const taxRate = Number(settings?.defaultTaxRate || 0);
    // Discount is applied before tax, matching the server's money math.
    const discount = Math.min(Math.max(Number(invoice.discount || 0), 0), subtotal);
    const taxable = subtotal - discount;
    const tax = taxable * (taxRate / 100);
    const total = Number(invoice.total ?? taxable + tax);
    const paid = Number(invoice.paid || 0);
    return { subtotal, discount, taxable, tax, total, taxRate, paid, remaining: Math.max(0, total - paid) };
  }, [invoice, settings]);

  async function handleStatusChange(newStatus) {
    setActionLoading(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const updated = await api.updateInvoiceStatus(id, newStatus);
      setInvoice((prev) => ({ ...updated, auditLogs: updated.auditLogs || prev.auditLogs }));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Emails the invoice to the client. Drafts are moved to Pending first, then
  // the email goes out. The server replies with simulated:true when SMTP isn't
  // configured so the flow works end-to-end without credentials.
  async function handleSendInvoice() {
    setActionLoading(true);
    setActionError('');
    setSuccessMessage('');
    try {
      if (invoice.status === 'draft') {
        await api.updateInvoiceStatus(id, 'pending');
      }
      const result = await api.sendInvoiceEmail(id);
      setSuccessMessage(
        result.simulated
          ? 'Email simulated — SMTP isn\'t configured. Delivery is logged in the server console + email history.'
          : `Invoice sent to ${invoice.client.email}.`
      );
      await load(true);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendReminder() {
    setActionLoading(true);
    setActionError('');
    setSuccessMessage('');
    try {
      const result = await api.sendReminderEmail(id);
      setSuccessMessage(
        result.simulated
          ? 'Reminder simulated — SMTP isn\'t configured. Delivery is logged in the server console + email history.'
          : `Reminder sent to ${invoice.client.email}.`
      );
      await load(true);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRecordPayment(payload) {
    setActionLoading(true);
    setActionError('');
    try {
      const { invoice: updated } = await api.recordPayment({ invoiceId: id, ...payload });
      setInvoice(updated);
      setPaymentModalOpen(false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDownloadPdf() {
    setActionError('');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      const blue = [13, 110, 253];
      const gray = [210, 210, 215];

      // Outer card border
      doc.setDrawColor(30, 30, 30);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin - 2, margin - 2, contentWidth + 4, 273, 3, 3);

      // Header block
      let y = margin;
      doc.setFillColor(...blue);
      doc.rect(margin, y, contentWidth, 26, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(profile?.businessName || 'Your Business', margin + 5, y + 8);

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      const headerAddressLines = [profile?.street, profile?.city, profile?.state, profile?.country].filter(Boolean);
      headerAddressLines.slice(0, 3).forEach((line, i) => doc.text(line, margin + 5, y + 13 + i * 4.5));

      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('INVOICE', margin + contentWidth - 5, y + 15, { align: 'right' });
      y += 26;

      // "Invoice Details" banner
      doc.setFillColor(...blue);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('Invoice Details', margin + 5, y + 5.5);
      y += 8;

      // Customer name (left) + invoice meta grid (right)
      const metaY = y;
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(invoice.client.name, margin + 5, metaY + 6);
      if (invoice.client.email) {
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(invoice.client.email, margin + 5, metaY + 11);
      }

      autoTable(doc, {
        startY: y,
        margin: { left: margin + contentWidth * 0.52, right: margin },
        tableWidth: contentWidth * 0.48,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2 },
        body: [
          [{ content: 'Invoice #', styles: { fontStyle: 'bold' } }, invoice.invoiceNumber,
            { content: 'Date', styles: { fontStyle: 'bold' } }, fmtDate(invoice.issueDate)],
          [{ content: 'Currency', styles: { fontStyle: 'bold' } }, settings?.currency || 'USD',
            { content: 'Due Date', styles: { fontStyle: 'bold' } }, fmtDate(invoice.dueDate)],
        ],
      });
      y = Math.max(doc.lastAutoTable.finalY, metaY + 14) + 6;

      // Billing / Shipping address — structured boxes (Street, then City|State, then Zip|Country)
      // matching the template exactly. Since this app tracks one address per client
      // (no separate shipping address), both boxes show the same real data rather
      // than inventing a second location.
      function drawAddressBox(startX, startY, width, title, entity) {
        doc.setTextColor(20, 20, 20);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(title, startX, startY);

        const rowH = 8;
        const halfW = (width - 2) / 2;
        let by = startY + 3;

        function cell(cx, cy, cw, label, value) {
          doc.setDrawColor(...gray);
          doc.setLineWidth(0.2);
          doc.rect(cx, cy, cw, rowH);
          if (value) {
            doc.setTextColor(20, 20, 20);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
            doc.text(String(value), cx + 2, cy + rowH / 2 + 1.3, { maxWidth: cw - 4 });
          } else {
            doc.setTextColor(165, 165, 170);
            doc.setFont(undefined, 'italic');
            doc.setFontSize(8);
            doc.text(label, cx + 2, cy + rowH / 2 + 1.3);
          }
        }

        cell(startX, by, width, 'Street Address', entity?.street);
        by += rowH;
        cell(startX, by, halfW, 'City', entity?.city);
        cell(startX + halfW + 2, by, halfW, 'State', entity?.state);
        by += rowH;
        cell(startX, by, halfW, 'Zip Code', entity?.zipCode);
        cell(startX + halfW + 2, by, halfW, 'Country', entity?.country);
        by += rowH;

        return by;
      }

      const colGap = 6;
      const colW = (contentWidth - colGap) / 2;
      const addrBottom = drawAddressBox(margin, y, colW, 'Billing Address', invoice.client);
      drawAddressBox(margin + colW + colGap, y, colW, 'Shipping Address', invoice.client);
      y = addrBottom + 6;

      // Items table
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['#', 'Items', 'Qty', 'Rate', 'Amount']],
        headStyles: { fillColor: blue, textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 10 },
          2: { halign: 'right', cellWidth: 20 },
          3: { halign: 'right', cellWidth: 26 },
          4: { halign: 'right', cellWidth: 28 },
        },
        body: invoice.items.map((item, i) => [
          i + 1,
          item.description,
          Number(item.quantity).toFixed(2),
          formatMoney(item.unitPrice),
          formatMoney(Number(item.quantity) * Number(item.unitPrice)),
        ]),
      });
      y = doc.lastAutoTable.finalY + 8;

      // Terms & Notes (left) + Totals (right)
      const leftW = contentWidth * 0.55;
      const rightX = margin + leftW + 5;
      const rightW = contentWidth - leftW - 5;

      doc.setTextColor(20, 20, 20);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Terms & Conditions', margin + 5, y);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.text(`Payment due within ${paymentTermDays} days of the issue date.`, margin + 5, y + 5, { maxWidth: leftW - 10 });

      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Notes', margin + 5, y + 16);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.text(invoice.notes || '—', margin + 5, y + 21, { maxWidth: leftW - 10 });

      autoTable(doc, {
        startY: y,
        margin: { left: rightX, right: margin },
        tableWidth: rightW,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5 },
        body: [
          [{ content: 'Sub Total', styles: { fontStyle: 'bold' } }, { content: formatMoney(totals.subtotal), styles: { halign: 'right' } }],
          ...(totals.discount > 0
            ? [[{ content: 'Discount', styles: { fontStyle: 'bold' } }, { content: `− ${formatMoney(totals.discount)}`, styles: { halign: 'right' } }]]
            : []),
          [{ content: `Tax (${totals.taxRate}%)`, styles: { fontStyle: 'bold' } }, { content: formatMoney(totals.tax), styles: { halign: 'right' } }],
        ],
      });

      const totalsY = doc.lastAutoTable.finalY;
      doc.setFillColor(...blue);
      doc.rect(rightX, totalsY, rightW, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('Total', rightX + 3, totalsY + 6);
      doc.text(
        formatMoney(totals.remaining),
        rightX + rightW - 3,
        totalsY + 6,
        { align: 'right' }
      );

      doc.setTextColor(140, 140, 140);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text('Thank you for your business.', pageWidth / 2, 285, { align: 'center' });

      doc.save(`${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      // Log the real error — the fallback message below is a last resort,
      // not a diagnosis. Check the console for what actually broke.
      console.error('PDF generation failed:', err);
      setActionError(`Couldn't generate the PDF: ${err.message || 'Unknown error — check the browser console.'}`);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-10 text-center text-sm text-[#464555]">Loading invoice...</div>
      </DashboardLayout>
    );
  }

  if (error || !invoice) {
    return (
      <DashboardLayout>
        <div className="py-10 text-center">
          <p className="text-sm text-red-600 mb-2">{error || 'Invoice not found'}</p>
          <Link to="/dashboard" className="text-sm font-semibold text-[#3525cd] hover:underline">
            Back to Invoices
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const displayStatus = computeDisplayStatus(invoice);
  const statusStyle = STATUS_STYLES[displayStatus];
  const paymentTermDays = daysBetween(invoice.dueDate, invoice.issueDate);
  const daysToDue = daysBetween(invoice.dueDate, new Date());

  return (
    <DashboardLayout>
      <div className="py-4">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-1 text-sm text-[#464555] hover:text-[#131b2e]">
              ← Back to Invoices
            </Link>
            <span className="w-1.5 h-1.5 rounded-full bg-[#c7c4d8]" />
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-lg tracking-tight text-[#131b2e]">
                #{invoice.invoiceNumber}
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
                {statusStyle.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canWrite && (
              <>
                {invoice.status === 'draft' ? (
                  <button
                    onClick={handleSendInvoice}
                    disabled={actionLoading || !invoice.client.email}
                    title={invoice.client.email ? '' : `Add an email to ${invoice.client.name} to send invoices`}
                    className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-sm text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Sending...' : 'Save & Send Invoice'}
                  </button>
                ) : (
                  <button
                    onClick={handleSendInvoice}
                    disabled={actionLoading || !invoice.client.email}
                    title={invoice.client.email ? '' : `Add an email to ${invoice.client.name} to send invoices`}
                    className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] shadow-sm text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Sending...' : 'Email Invoice'}
                  </button>
                )}
                {invoice.status === 'pending' && (
                  <button
                    onClick={() => handleStatusChange('paid')}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 bg-[#006c49] hover:bg-[#00583b] shadow-sm text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    ✓ {actionLoading ? 'Updating...' : 'Mark as Paid'}
                  </button>
                )}
                {invoice.status !== 'draft' && invoice.status !== 'paid' && (
                  <button
                    onClick={handleSendReminder}
                    disabled={actionLoading || !invoice.client.email}
                    title={invoice.client.email ? '' : `Add an email to ${invoice.client.name} to send reminders`}
                    className="flex items-center gap-1.5 bg-[#f2f3ff] hover:bg-[#e2e7ff] text-sm font-semibold text-[#464555] px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Sending...' : 'Send Reminder'}
                  </button>
                )}
              </>
            )}
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 bg-[#f2f3ff] hover:bg-[#e2e7ff] text-sm text-[#464555] px-4 py-2 rounded-xl transition-colors"
            >
              ↓ PDF
            </button>
            {canWrite && (
              <Link
                to={`/invoices/${invoice.id}/edit`}
                className="flex items-center justify-center bg-[#f2f3ff] hover:bg-[#e2e7ff] rounded-xl size-9 transition-colors"
                title="Edit invoice"
              >
                🖊
              </Link>
            )}
          </div>
          {canWrite && !invoice.client.email && (
            <p className="text-xs text-[#9694a8] mt-2">
              Add an email address to <span className="font-semibold text-[#464555]">{invoice.client.name}</span> to enable
              sending invoices and reminders to them.
            </p>
          )}
        </div>

        {actionError && (
          <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{actionError}</div>
        )}
        {successMessage && (
          <div className="mb-4 bg-[#e5f7ee] text-[#0e7a41] text-sm px-4 py-3 rounded-xl">{successMessage}</div>
        )}

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Main invoice document */}
          <div className="lg:col-span-8 bg-white rounded-2xl shadow-[0_4px_35px_0_rgba(19,27,46,0.06),0_1px_3px_0_rgba(19,27,46,0.04)] overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#3525cd] via-[#4f46e5] to-[#6cf8bb]" />
            <div className="p-8">
              {/* Header */}
              <div className="flex items-start justify-between pb-10 flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="size-9 rounded-xl bg-[#3525cd] shadow-md flex items-center justify-center">
                      <span className="text-white text-xs font-bold">B</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight text-[#131b2e]">
                      {profile?.businessName || 'Your Business'}
                    </span>
                  </div>
                  <p className="text-xs text-[#464555]">Automated Billing Ledger · Standard Terms</p>
                </div>
                <div className="text-right">
                  <p className="text-[28px] font-bold tracking-tight text-[#131b2e]">INVOICE</p>
                  <p className="font-mono font-semibold text-sm text-[#3525cd]">#{invoice.invoiceNumber}</p>
                </div>
              </div>

              {/* Meta grid */}
              <div className="bg-[#f2f3ff] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                <div>
                  <p className="text-xs text-[#464555] mb-0.5">Issue Date</p>
                  <p className="text-sm font-semibold text-[#131b2e]">{fmtDate(invoice.issueDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#464555] mb-0.5">Due Date</p>
                  <p className="text-sm font-semibold text-[#131b2e]">{fmtDate(invoice.dueDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#464555] mb-0.5">Payment Terms</p>
                  <p className="text-sm font-semibold text-[#131b2e]">Net {paymentTermDays} Days</p>
                </div>
                <div>
                  <p className="text-xs text-[#464555] mb-0.5">Currency</p>
                  <p className="text-sm font-semibold text-[#131b2e]">{settings?.currency || 'USD'}</p>
                </div>
              </div>

              {/* Billed from / to */}
              <div className="grid sm:grid-cols-2 gap-6 mb-10">
                <div className="bg-[#faf8ff] rounded-xl p-4">
                  <p className="text-xs font-semibold tracking-wide uppercase text-[#464555] mb-2">Billed From</p>
                  <p className="font-semibold text-[#131b2e]">{profile?.businessName || 'Set up your business profile'}</p>
                  {formatAddress(profile)?.map((line, i) => (
                    <p key={i} className="text-xs text-[#464555] mt-0.5">{line}</p>
                  ))}
                  {profile?.email && <p className="text-xs font-medium text-[#3525cd] mt-1">{profile.email}</p>}
                </div>
                <div className="bg-[#faf8ff] rounded-xl p-4">
                  <p className="text-xs font-semibold tracking-wide uppercase text-[#464555] mb-2">Billed To</p>
                  <p className="font-semibold text-[#131b2e]">{invoice.client.name}</p>
                  {formatAddress(invoice.client)?.map((line, i) => (
                    <p key={i} className="text-xs text-[#464555] mt-0.5">{line}</p>
                  ))}
                  {invoice.client.email && <p className="text-xs font-medium text-[#3525cd] mt-1">{invoice.client.email}</p>}
                </div>
              </div>

              {/* Line items */}
              <div className="rounded-xl overflow-hidden mb-8 border border-[#e2e7ff]">
                <table className="w-full text-left">
                  <thead className="bg-[#eaedff]">
                    <tr>
                      <th className="px-4 py-2 text-xs font-semibold tracking-wide uppercase text-[#464555]">Description</th>
                      <th className="px-4 py-2 text-xs font-semibold tracking-wide uppercase text-[#464555] text-right">Qty</th>
                      <th className="px-4 py-2 text-xs font-semibold tracking-wide uppercase text-[#464555] text-right">Rate</th>
                      <th className="px-4 py-2 text-xs font-semibold tracking-wide uppercase text-[#464555] text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="border-t border-[#e2e7ff]">
                        <td className="px-4 py-3 text-sm font-medium text-[#131b2e]">{item.description}</td>
                        <td className="px-4 py-3 text-sm text-[#131b2e] text-right">{Number(item.quantity).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-[#131b2e] text-right">{formatMoney(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#131b2e] text-right">
                          {formatMoney(Number(item.quantity) * Number(item.unitPrice))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes + totals */}
              <div className="bg-[#f2f3ff] rounded-xl p-4 flex flex-col sm:flex-row gap-6 justify-between mb-10">
                <div className="max-w-sm">
                  <p className="text-xs font-semibold tracking-wide uppercase text-[#464555] mb-1">Client Notes</p>
                  <p className="text-xs text-[#464555]">{invoice.notes || '—'}</p>
                </div>
                <div className="w-full sm:w-52 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#464555]">Subtotal</span>
                    <span className="text-[#131b2e]">{formatMoney(totals.subtotal)}</span>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#464555]">Discount</span>
                      <span className="text-[#131b2e]">− {formatMoney(totals.discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#464555]">Tax ({totals.taxRate}%)</span>
                    <span className="text-[#131b2e]">{formatMoney(totals.tax)}</span>
                  </div>
                  <div className="h-px bg-[#c7c4d8]/50 my-1" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#131b2e]">Total Amount</span>
                    <span className="font-bold text-lg text-[#131b2e]">{formatMoney(totals.total)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#3525cd] rounded-xl px-3 py-2 mt-1">
                    <span className="text-sm text-white">Amount Due</span>
                    <span className="font-bold text-white">
                      {formatMoney(totals.remaining)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bank wire details — only if the profile has them */}
              {profile?.bankName && (
                <div className="bg-[#faf8ff] rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-semibold text-[#131b2e]">🏦 Direct Bank Wire Details</p>
                    <span className="text-xs font-medium uppercase text-[#464555]">ACH · Wire</span>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-[#464555] mb-1">Beneficiary Bank</p>
                      <p className="text-xs font-semibold text-[#131b2e]">{profile.bankName}</p>
                    </div>
                    {profile.routingNumber && (
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-[#464555] mb-1">Routing Number</p>
                        <p className="text-xs font-semibold text-[#131b2e]">{profile.routingNumber}</p>
                      </div>
                    )}
                    {profile.accountNumber && (
                      <div className="bg-white rounded-lg p-3">
                        <p className="text-xs text-[#464555] mb-1">Account Number</p>
                        <p className="text-xs font-semibold text-[#131b2e]">{profile.accountNumber}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-[#c7c4d8]/30 text-xs text-[#464555] flex-wrap gap-2">
                <span>{profile?.taxNumber ? `Tax ID: ${profile.taxNumber}` : ''}</span>
                <span>Payment is expected within {paymentTermDays} calendar days of receipt.</span>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-[#131b2e] mb-4">Invoice Overview</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between bg-[#f2f3ff] rounded-xl p-3">
                  <div>
                    <p className="text-xs text-[#464555]">
                      {invoice.status === 'paid' ? 'Paid On' : daysToDue >= 0 ? 'Days Remaining' : 'Overdue By'}
                    </p>
                    <p className="text-sm font-semibold text-[#131b2e]">
                      {invoice.status === 'paid'
                        ? fmtDate(invoice.paidAt)
                        : `${Math.abs(daysToDue)} Days`}
                    </p>
                  </div>
                  {invoice.status !== 'paid' && (
                    <span
                      className="text-xs font-semibold"
                      style={{ color: daysToDue >= 0 ? '#684000' : '#ba1a1a' }}
                    >
                      {daysToDue >= 0 ? 'On Track' : 'Overdue'}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between bg-[#f2f3ff] rounded-xl p-3">
                  <div>
                    <p className="text-xs text-[#464555]">Email Status</p>
                    <p className="text-sm font-semibold text-[#131b2e]">
                      {invoice.status === 'draft'
                        ? 'Draft — not sent'
                        : invoice.sentAt
                          ? `Sent ${fmtDate(invoice.sentAt)}`
                          : 'Not sent yet'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#f2f3ff] rounded-xl p-3">
                  <div>
                    <p className="text-xs text-[#464555]">Line Items</p>
                    <p className="text-sm font-semibold text-[#131b2e]">{invoice.items.length}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-[#f2f3ff] rounded-xl p-3">
                  <div>
                    <p className="text-xs text-[#464555]">Client Since</p>
                    <p className="text-sm font-semibold text-[#131b2e]">{fmtDate(invoice.client.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[#131b2e]">Payment History</h3>
                {invoice.payments.length > 0 && (
                  <span className="text-xs text-[#464555]">
                    {invoice.payments.length} payment{invoice.payments.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between bg-[#f2f3ff] rounded-xl p-3 mb-3">
                <div>
                  <p className="text-xs text-[#464555]">Total</p>
                  <p className="text-sm font-semibold text-[#131b2e]">{formatMoney(totals.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#464555]">Paid</p>
                  <p className="text-sm font-semibold text-[#006c49]">{formatMoney(totals.paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#464555]">Remaining</p>
                  <p className={`text-sm font-semibold ${totals.remaining > 0 ? 'text-[#ba1a1a]' : 'text-[#006c49]'}`}>
                    {formatMoney(totals.remaining)}
                  </p>
                </div>
              </div>

              {invoice.payments.length === 0 ? (
                <p className="text-xs text-[#464555] mb-3">No payments recorded yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-gray-100 mb-3">
                  {invoice.payments.map((p) => (
                    <div key={p.id} className="py-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#131b2e]">{formatMoney(p.amount)}</p>
                          <p className="text-xs text-[#464555]">
                            {fmtDate(new Date(p.paymentDate))}
                            {p.method ? ` · ${p.method}` : ''}
                          </p>
                        </div>
                      </div>
                      {p.reference && <p className="text-xs text-[#464555] font-mono mt-0.5">Ref: {p.reference}</p>}
                      {p.notes && <p className="text-xs text-[#464555] mt-0.5">{p.notes}</p>}
                    </div>
                  ))}
                </div>
              )}

              {canWrite && (
                <button
                  onClick={() => setPaymentModalOpen(true)}
                  disabled={invoice.status === 'paid' || invoice.status === 'draft' || actionLoading}
                  title={
                    invoice.status === 'draft'
                      ? 'Send the invoice before recording payments'
                      : invoice.status === 'paid'
                        ? 'Invoice fully paid'
                        : ''
                  }
                  className="w-full flex items-center justify-center gap-1.5 bg-[#006c49] hover:bg-[#00583b] text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Record Payment
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[#131b2e]">Audit History</h3>
                <span className="text-xs text-[#464555]">{invoice.auditLogs.length} events</span>
              </div>
              <div className="flex flex-col gap-6 pl-6 relative">
                <div className="absolute left-2 top-2 bottom-2 w-px bg-[#e2e7ff]" />
                {invoice.auditLogs.length === 0 && (
                  <p className="text-xs text-[#464555]">No activity yet.</p>
                )}
                {invoice.auditLogs.map((log, i) => (
                  <div key={log.id} className="relative">
                    <span
                      className="absolute -left-6 top-0.5 size-4 rounded-full ring-4 ring-white"
                      style={{ backgroundColor: i === 0 ? '#006c49' : '#c7c4d8' }}
                    />
                    <p className="text-sm font-semibold text-[#131b2e]">{ACTION_LOG_LABEL[log.type] || log.type}</p>
                    <p className="text-xs text-[#464555]">{log.message}</p>
                    <p className="text-xs text-[#464555] font-mono mt-0.5">{fmtDateTime(log.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(150deg, #4f46e5 0%, #3525cd 100%)' }}>
              <div className="absolute -right-4 -bottom-4 size-28 rounded-full bg-white/10 blur-2xl" />
              <p className="font-bold mb-2 relative">📬 Email Delivery</p>
              <p className="text-xs text-[#dad7ff] relative">
                Send invoices and reminders straight to clients, and let the app flag overdue invoices in
                your notification bell. Without SMTP credentials emails are simulated and logged — add SMTP
                vars to the server's <span className="font-mono">.env</span> to send for real.
              </p>
              <div className="flex items-center justify-between border-t border-white/20 pt-3 mt-4 relative">
                <span className="text-xs">{emailStatus?.configured ? 'SMTP: configured' : 'SMTP: not configured — simulated'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {paymentModalOpen && (
        <PaymentModal
          remaining={totals.remaining}
          currencySymbol={currencySymbol}
          saving={actionLoading}
          error={actionError}
          onClose={() => setPaymentModalOpen(false)}
          onSubmit={handleRecordPayment}
        />
      )}
    </DashboardLayout>
  );
}