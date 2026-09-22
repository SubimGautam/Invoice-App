const crypto = require('crypto');

// Unguessable token that powers the public "Pay now" payment link. Clients pay
// without an account, so this token is the only credential behind the link —
// keep it long and random (48 hex chars ≈ 192 bits).
function generatePaymentToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { generatePaymentToken };