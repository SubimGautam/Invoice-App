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

function dueLabel(dueDate) {
  return dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
}

function summaryTable(invoiceNumber, due, total) {
  return `
    <table style="width:100%;border-collapse:collapse;background:#f2f3ff;border-radius:12px;">
      <tr>
        <td style="padding:14px 18px;font-size:12px;color:#464555;text-transform:uppercase;letter-spacing:0.6px;">Invoice</td>
        <td style="padding:14px 18px;font-size:12px;color:#464555;text-transform:uppercase;letter-spacing:0.6px;">Due date</td>
        <td style="padding:14px 18px;font-size:12px;color:#464555;text-transform:uppercase;letter-spacing:0.6px;text-align:right;">Total</td>
      </tr>
      <tr>
        <td style="padding:4px 18px 14px;font-size:14px;font-weight:700;color:#131b2e;">${invoiceNumber}</td>
        <td style="padding:4px 18px 14px;font-size:14px;color:#131b2e;">${due}</td>
        <td style="padding:4px 18px 14px;font-size:14px;font-weight:700;color:#131b2e;text-align:right;">${total}</td>
      </tr>
    </table>`;
}

// An invoice email: polite intro + key numbers + a button to view the invoice.
function invoiceEmail({ businessName, clientName, invoiceNumber, total, dueDate, invoiceId, note = '' }) {
  const subject = `Invoice ${invoiceNumber} from ${businessName}`;
  const link = invoiceUrl(invoiceId);
  const html = shell({
    businessName,
    preheader: `Your invoice ${invoiceNumber} is ready.`,
    body: `
      <p style="margin:0 0 8px;color:#131b2e;font-size:15px;font-weight:600;">Hi ${clientName},</p>
      <p style="margin:0 0 20px;color:#464555;font-size:14px;line-height:1.5;">
        Please find your invoice below. You can view and pay it at any time.
      </p>
      ${summaryTable(invoiceNumber, dueLabel(dueDate), amount(total))}
      ${note ? `<p style="margin:16px 0 0;color:#464555;font-size:13px;line-height:1.5;">${note}</p>` : ''}
      <a href="${link}" style="display:inline-block;margin-top:24px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px;">View Invoice</a>
    `
  });
  return { subject, html };
}

// A reminder: the invoice is still open / overdue.
function reminderEmail({ businessName, clientName, invoiceNumber, total, dueDate, invoiceId, overdue = false }) {
  const subject = overdue
    ? `Overdue: Invoice ${invoiceNumber} from ${businessName}`
    : `Reminder: Invoice ${invoiceNumber} from ${businessName}`;
  const line = overdue
    ? 'We noticed this invoice is now overdue. If the payment has already been made, please disregard this message.'
    : 'This is a friendly reminder that the invoice below is still open.';
  const html = shell({
    businessName,
    preheader: subject,
    body: `
      <p style="margin:0 0 8px;color:#131b2e;font-size:15px;font-weight:600;">Hi ${clientName},</p>
      <p style="margin:0 0 20px;color:#464555;font-size:14px;line-height:1.5;">${line}</p>
      ${summaryTable(invoiceNumber, dueLabel(dueDate), amount(total))}
      <a href="${invoiceUrl(invoiceId)}" style="display:inline-block;margin-top:24px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px;">View Invoice</a>
    `
  });
  return { subject, html };
}

module.exports = { invoiceEmail, reminderEmail, invoiceUrl, amount };