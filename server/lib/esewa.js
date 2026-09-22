const crypto = require('crypto');

// eSewa Intent Payment driver.
// Docs: https://developer.esewa.com.np/pages/Intent
//
// Flow: book -> redirect to eSewa (app deeplink on mobile, ePay web on desktop)
//       -> client pays -> status check / callback -> only "SUCCESS" is a payment.
//
// The test secret + product code below are PUBLISHED BY ESEWA for development
// (UAT). Override via env when you have live merchant credentials:
//   ESEWA_BOOK_URL    (prod differs from the rc-checkout UAT host)
//   ESEWA_STATUS_URL
//   ESEWA_SECRET
//   ESEWA_PRODUCT_CODE

const DEFAULT_PRODUCT_CODE = 'INTENT';
const DEFAULT_SECRET = 'LB0REg8HUSw3MTYrI1s6JTE8Kyc6JyAqJiA3MQ==';

const BOOK_URL = process.env.ESEWA_BOOK_URL || 'https://rc-checkout.esewa.com.np/api/client/intent/payment/book';
const STATUS_URL = process.env.ESEWA_STATUS_URL || 'https://rc-checkout.esewa.com.np/api/client/intent/payment/status';
const SECRET = process.env.ESEWA_SECRET || DEFAULT_SECRET;
const PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || DEFAULT_PRODUCT_CODE;

function sign(message, key = SECRET) {
  return crypto.createHmac('sha256', key).update(message).digest('base64');
}

// eSewa's Intent API books amounts in paisa (Rs 1 = 100 paisa).
function toPaisa(npr) {
  return Math.round(Number(npr) * 100);
}

// POST /api/client/intent/payment/book — create a booking and get the deeplink.
// amount is in NPR (converted to paisa internally); minimum Rs 1.
async function initiate({ amount, transactionUuid, callbackUrl, redirectUrl, customerId, remarks }) {
  const amountPaisa = toPaisa(amount);
  if (amountPaisa < 100) throw new Error('Amount must be at least Rs 1');

  const signature = sign(
    `product_code=${PRODUCT_CODE},amount=${amountPaisa},transaction_uuid=${transactionUuid}`
  );

  const res = await fetch(BOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_code: PRODUCT_CODE,
      amount: amountPaisa,
      transaction_uuid: transactionUuid,
      signed_field_names: 'product_code,amount,transaction_uuid',
      signature,
      callback_url: callbackUrl,
      redirect_url: redirectUrl,
      properties: {
        customer_id: customerId || 'client',
        remarks: remarks || ''
      }
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.code && !String(data.code).startsWith('IP-2'))) {
    throw new Error(data.error_message || data.message || 'eSewa could not start the payment');
  }

  return {
    bookingId: data.data?.booking_id,
    deeplink: data.data?.deeplink,
    correlationId: data.data?.correlation_id,
    raw: data
  };
}

// POST /api/client/intent/payment/status — final status of a booking.
// Returns { status, referenceCode, gatewayTxnId }. Only status === 'SUCCESS'
// is a confirmed, recorded payment.
async function verify({ bookingId, correlationId }) {
  const signature = sign(
    `booking_id=${bookingId},product_code=${PRODUCT_CODE},correlation_id=${correlationId}`
  );

  const res = await fetch(STATUS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: bookingId,
      product_code: PRODUCT_CODE,
      correlation_id: correlationId,
      signed_field_names: 'booking_id,product_code,correlation_id',
      signature
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_message || 'eSewa status check failed');
  }

  return {
    status: data.data?.status || 'UNKNOWN', // BOOKED | SUCCESS | PENDING | FAILED | CANCELED | REVERTED
    referenceCode: data.data?.reference_code || null,
    gatewayTxnId: data.data?.transaction_id || null,
    raw: data
  };
}

// Verify an eSewa webhook (callback) payload: rebuild the signed message from
// signed_field_names and compare the HMAC. Returns { ok, error? }.
function verifyCallbackSignature(data) {
  const names = String(data.signed_field_names || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  const message = names.map((n) => `${n}=${data[n]}`).join(',');
  const expected = sign(message);
  const received = String(data.signature || '');
  const a = Buffer.from(expected, 'base64');
  const b = Buffer.from(received, 'base64');
  return { ok: a.length === b.length && crypto.timingSafeEqual(a, b) };
}

module.exports = { initiate, verify, verifyCallbackSignature, toPaisa };