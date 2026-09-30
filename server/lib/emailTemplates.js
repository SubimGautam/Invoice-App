// HTML email templates. Invoices link back to the web app (which offers the PDF
// download client-side) — the server doesn't render PDFs.

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

function invoiceUrl(invoiceId) {
  return `${CLIENT_URL}/invoices/${invoiceId}`;
}

function shell({ businessName, preheader, body }) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f2f3ff;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
        <div style="background:#4f46e5;padding:20px 28px;">
          <span style="color:#ffffff;font-size:16px;font-weight:700;">${businessName}</span>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 16px;color:#464555;font-size:14px;">${preheader}</p>
          ${body}
          <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #eeeeff;color:#777587;font-size:12px;">
            Sent by ${businessName} · billflow
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function amount(n, symbol = 'Rs. ') {
  return `${symbol}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// Keep email amounts on the workspace's currency (same map the client uses).
const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', NPR: 'Rs. ' };
function symbolFor(currency) {
  return CURRENCY_SYMBOLS[currency] || (currency ? `${currency} ` : 'Rs. ');
}

function dueLabel(dueDate) {
  return dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
}

// Three-up key figure strip. The labels are parameters because the middle
// column means different things per document ("Due date" on an invoice,
// "Valid until" on an estimate).
function summaryTable(docNumber, midValue, total, { docLabel = 'Invoice', midLabel = 'Due date' } = {}) {
  return `
    <table style="width:100%;border-collapse:collapse;background:#f2f3ff;border-radius:12px;">
      <tr>
        <td style="padding:14px 18px;font-size:12px;color:#464555;text-transform:uppercase;letter-spacing:0.6px;">${docLabel}</td>
        <td style="padding:14px 18px;font-size:12px;color:#464555;text-transform:uppercase;letter-spacing:0.6px;">${midLabel}</td>
        <td style="padding:14px 18px;font-size:12px;color:#464555;text-transform:uppercase;letter-spacing:0.6px;text-align:right;">Total</td>
      </tr>
      <tr>
        <td style="padding:4px 18px 14px;font-size:14px;font-weight:700;color:#131b2e;">${docNumber}</td>
        <td style="padding:4px 18px 14px;font-size:14px;color:#131b2e;">${midValue}</td>
        <td style="padding:4px 18px 14px;font-size:14px;font-weight:700;color:#131b2e;text-align:right;">${total}</td>
      </tr>
    </table>`;
}

// An invoice email: polite intro + key numbers + view/pay buttons.
function invoiceEmail({ businessName, clientName, invoiceNumber, total, dueDate, invoiceId, note = '', currency = 'NPR', paymentToken = null }) {
  const subject = `Invoice ${invoiceNumber} from ${businessName}`;
  const link = invoiceUrl(invoiceId);
  const payHref = paymentToken ? `${CLIENT_URL}/pay/${paymentToken}` : null;
  const html = shell({
    businessName,
    preheader: `Your invoice ${invoiceNumber} is ready.`,
    body: `
      <p style="margin:0 0 8px;color:#131b2e;font-size:15px;font-weight:600;">Hi ${clientName},</p>
      <p style="margin:0 0 20px;color:#464555;font-size:14px;line-height:1.5;">
        Please find your invoice below. You can view and pay it at any time.
      </p>
      ${summaryTable(invoiceNumber, dueLabel(dueDate), amount(total, symbolFor(currency)))}
      ${note ? `<p style="margin:16px 0 0;color:#464555;font-size:13px;line-height:1.5;">${note}</p>` : ''}
      ${actionButtons(link, payHref)}
    `
  });
  return { subject, html };
}

// A reminder: the invoice is still open / overdue.
function reminderEmail({ businessName, clientName, invoiceNumber, total, dueDate, invoiceId, overdue = false, currency = 'NPR', paymentToken = null }) {
  const subject = overdue
    ? `Overdue: Invoice ${invoiceNumber} from ${businessName}`
    : `Reminder: Invoice ${invoiceNumber} from ${businessName}`;
  const line = overdue
    ? 'We noticed this invoice is now overdue. If the payment has already been made, please disregard this message.'
    : 'This is a friendly reminder that the invoice below is still open.';
  const payHref = paymentToken ? `${CLIENT_URL}/pay/${paymentToken}` : null;
  const html = shell({
    businessName,
    preheader: subject,
    body: `
      <p style="margin:0 0 8px;color:#131b2e;font-size:15px;font-weight:600;">Hi ${clientName},</p>
      <p style="margin:0 0 20px;color:#464555;font-size:14px;line-height:1.5;">${line}</p>
      ${summaryTable(invoiceNumber, dueLabel(dueDate), amount(total, symbolFor(currency)))}
      ${actionButtons(invoiceUrl(invoiceId), payHref)}
    `
  });
  return { subject, html };
}

// One call-to-action button. `tone` picks the visual weight:
//   'pay'     — filled green, the money action on an invoice
//   'primary' — filled indigo, the lone action when there is no money involved
//   'outline' — the secondary that sits beside either of those
// Declaration order matches the pre-existing invoice buttons exactly, so
// refactoring these into a helper is a no-op for the emails clients get today.
function ctaButton(href, label, tone = 'primary') {
  const styles = {
    pay: 'background:#006c49;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;',
    primary: 'background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;',
    outline: 'margin-left:12px;background:#ffffff;color:#4f46e5;border:1px solid #c7c4d8;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;'
  };
  return `<a href="${href}" style="display:inline-block;${styles[tone] || styles.primary}border-radius:12px;">${label}</a>`;
}

// Primary "Pay now" (public payment link, no account needed) + secondary
// "View Invoice". Falls back to a single button when no token exists.
function actionButtons(viewHref, payHref, { primaryLabel = 'Pay Now', secondaryLabel = 'View Invoice' } = {}) {
  if (!payHref) return ctaButton(viewHref, secondaryLabel);
  return ctaButton(payHref, primaryLabel, 'pay') + ctaButton(viewHref, secondaryLabel, 'outline');
}

// A quote email. The client is asked to review + accept/decline from the public
// quote link. That link is the ONLY call to action: it is what records their
// answer, and the in-app estimate page is behind a login the client does not
// have, so offering it here would just dead-end them at /login.
function estimateEmail({ businessName, clientName, estimateNumber, total, validUntil, estimateId, viewToken = null, note = '', currency = 'NPR' }) {
  const subject = `Estimate ${estimateNumber} from ${businessName}`;
  // Defensive fallback: if a token were ever missing, point at the app rather
  // than shipping an email with a dead button.
  const href = viewToken
    ? `${CLIENT_URL}/q/${viewToken}`
    : estimateId
      ? `${CLIENT_URL}/estimates/${estimateId}`
      : CLIENT_URL;
  const validLabel = validUntil
    ? new Date(validUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';
  const html = shell({
    businessName,
    preheader: `Estimate ${estimateNumber} is ready for your review.`,
    body: `
      <p style="margin:0 0 8px;color:#131b2e;font-size:15px;font-weight:600;">Hi ${clientName},</p>
      <p style="margin:0 0 20px;color:#464555;font-size:14px;line-height:1.5;">
        Please find our estimate below. You can review the full breakdown and accept or
        decline it online — no account needed.
      </p>
      ${summaryTable(estimateNumber, validLabel, amount(total, symbolFor(currency)), { docLabel: 'Estimate', midLabel: 'Valid until' })}
      ${note ? `<p style="margin:16px 0 0;color:#464555;font-size:13px;line-height:1.5;">${note}</p>` : ''}
      ${ctaButton(href, 'Review &amp; Respond')}
      <p style="margin:18px 0 0;color:#777587;font-size:12px;line-height:1.5;">
        This is an estimate, not a bill. Nothing is due until the work is invoiced.
      </p>
    `
  });
  return { subject, html };
}

// Receipt sent to the client after a payment lands through the payment link.
function paymentReceiptEmail({ businessName, clientName, invoiceNumber, amountPaid, remaining, currency = 'NPR', invoiceId }) {
  const sym = symbolFor(currency);
  const subject = `Payment received for ${invoiceNumber}`;
  const html = shell({
    businessName,
    preheader: `${amount(amountPaid, sym)} received on ${invoiceNumber}.`,
    body: `
      <p style="margin:0 0 8px;color:#131b2e;font-size:15px;font-weight:600;">Hi ${clientName},</p>
      <p style="margin:0 0 20px;color:#464555;font-size:14px;line-height:1.5;">
        Thanks — we've received your payment of <strong>${amount(amountPaid, sym)}</strong> for invoice
        <strong>${invoiceNumber}</strong>.
        ${remaining > 0 ? `There is still <strong>${amount(remaining, sym)}</strong> left to pay.` : 'This invoice is now fully settled.'}
      </p>
      ${summaryTable(invoiceNumber, remaining > 0 ? 'Remaining' : 'Paid in full', amount(amountPaid, sym))}
      <a href="${invoiceUrl(invoiceId)}" style="display:inline-block;margin-top:24px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px;">View Invoice</a>
    `
  });
  return { subject, html };
}

// Password reset email — link is single-use and expires in 1 hour.
function passwordResetEmail({ resetUrl }) {
  const subject = 'Reset your Billflow password';
  const html = shell({
    businessName: 'Billflow',
    preheader: 'Reset your password (link expires in 1 hour).',
    body: `
      <p style="margin:0 0 8px;color:#131b2e;font-size:15px;font-weight:600;">Hi there,</p>
      <p style="margin:0 0 20px;color:#464555;font-size:14px;line-height:1.5;">
        We received a request to reset your Billflow password. Use the button below to
        choose a new one — the link is single-use and expires in 1 hour.
      </p>
      <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px;">Reset Password</a>
      <p style="margin:20px 0 0;color:#777587;font-size:13px;line-height:1.5;">
        If you didn't request this, you can safely ignore this email — your password won't change.
      </p>
    `
  });
  return { subject, html };
}

// Internal heads-up sent to the business when a client answers a quote from the
// public link. Addressed to the team, not the client, so it says what to do next.
function estimateResponseEmail({ businessName, clientName, estimateNumber, decision, reason = '', total, currency = 'NPR', estimateId, declined }) {
  const sym = symbolFor(currency);
  const subject = declined
    ? `${estimateNumber} declined by ${clientName}`
    : `${estimateNumber} accepted by ${clientName}`;
  const html = shell({
    businessName,
    preheader: subject,
    body: `
      <p style="margin:0 0 8px;color:#131b2e;font-size:15px;font-weight:600;">${estimateNumber} was ${decision}</p>
      <p style="margin:0 0 20px;color:#464555;font-size:14px;line-height:1.5;">
        <strong>${clientName}</strong> responded to your estimate
        ${total != null ? `for <strong>${amount(total, sym)}</strong>` : ''} from the public quote link.
        ${declined ? 'No invoice was created.' : 'Convert it to an invoice when you are ready to bill.'}
      </p>
      ${summaryTable(estimateNumber, '—', total != null ? amount(total, sym) : '—', { docLabel: 'Estimate', midLabel: 'Amount' })}
      ${declined && reason ? `<p style="margin:16px 0 0;color:#464555;font-size:13px;line-height:1.5;"><strong>Their reason:</strong> ${reason}</p>` : ''}
      <a href="${estimateId ? `${CLIENT_URL}/estimates/${estimateId}` : CLIENT_URL}" style="display:inline-block;margin-top:24px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px;">Open Estimate</a>
    `
  });
  return { subject, html };
}

module.exports = { invoiceEmail, reminderEmail, paymentReceiptEmail, passwordResetEmail, estimateEmail, estimateResponseEmail, invoiceUrl, amount };