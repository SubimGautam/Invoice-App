const nodemailer = require('nodemailer');
const prisma = require('../prisma');

let transporter = null;

// SMTP is optional: when unconfigured the app still works end-to-end and every
// "send" is simulated (logged to the console + recorded in EmailLog with
// simulated=true) so development flows never hard-depend on credentials.
const SMTP_HOST = process.env.SMTP_HOST;
const configured = Boolean(SMTP_HOST);
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
  }
  return transporter;
}

// Send ONE email and persist the attempt in EmailLog so the UI can show
// delivery history. Returns { ok, simulated, error, log }.
async function sendEmail({ workspaceId, userId, invoiceId = null, type, to, subject, html }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@billflow.local';

  let ok = false;
  let simulated = false;
  let error = null;

  if (!configured) {
    simulated = true;
    console.log(`[mail][simulated] to=${to} subject="${subject}"`);
    console.log(`[mail][simulated] ---\n${html}\n---`);
  } else {
    try {
      await getTransporter().sendMail({ from, to, subject, html });
      ok = true;
    } catch (err) {
      error = err.message;
      console.error('[mail] send failed:', err.message);
    }
  }

  const log = await prisma.emailLog.create({
    data: { workspaceId, userId, invoiceId, type, to, subject, ok, simulated, error }
  });

  return { ok, simulated, error, log };
}

module.exports = { sendEmail, smtpConfigured: () => configured };