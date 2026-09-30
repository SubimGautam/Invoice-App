const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { notifyWorkspace } = require('../lib/notify');
const { sendEmail } = require('../lib/mailer');
const { estimateResponseEmail } = require('../lib/emailTemplates');
const { invoiceTotal } = require('../lib/money');

// Public quote endpoint — INTENTIONALLY not behind requireAuth. A client reviews
// and answers a quote without an account, authenticated only by the unguessable
// token in the "Review & respond" button of the estimate email.
//
// The token is the ONLY credential, so responses are deliberately constrained:
// a client may accept or decline a quote, but never edit one, and never touch a
// quote they have already answered differently.

const TOKEN_RE = /^[0-9a-f]{32,64}$/;

const router = express.Router();

async function loadByToken(token) {
  if (!TOKEN_RE.test(token)) return null;
  return prisma.estimate.findUnique({
    where: { viewToken: token },
    include: {
      client: true,
      items: true,
      workspace: { include: { settings: true, businessProfile: true } }
    }
  });
}

function toSummary(estimate) {
  const settings = estimate.workspace.settings;
  const taxRate = Number(settings?.defaultTaxRate || 0);
  const total = invoiceTotal(estimate, taxRate);
  return {
    // Deliberately no internal id, userId, workspaceId, viewToken or decline
    // reason: this is served without authentication, so it carries only what
    // the client needs to read the quote. (Nothing here is used to address a
    // record — the token is the only handle the client gets.)
    estimateNumber: estimate.estimateNumber,
    status: estimate.status,
    currency: settings?.currency || 'NPR',
    businessName: estimate.workspace.businessProfile?.businessName || estimate.workspace.name,
    clientName: estimate.client.name,
    issueDate: estimate.issueDate,
    validUntil: estimate.validUntil,
    notes: estimate.notes,
    discount: Number(estimate.discount || 0),
    items: estimate.items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      amount: Math.round(Number(it.quantity) * Number(it.unitPrice) * 100) / 100
    })),
    subtotal: Math.round(invoiceTotal({ items: estimate.items, discount: 0 }, taxRate) * 100) / 100,
    total: Math.round(total * 100) / 100,
    acceptedAt: estimate.acceptedAt,
    declinedAt: estimate.declinedAt
  };
}

// GET /api/estimate/:token — the quote as the client sees it.
router.get('/:token', async (req, res) => {
  const estimate = await loadByToken(req.params.token);
  // One identical message for unknown/invalid/draft links so the token can't be
  // probed. A draft has never been quoted to the client, so there is nothing to
  // show them.
  if (!estimate || estimate.status === 'draft') {
    return res.status(404).json({ error: 'This estimate link is not valid or the estimate no longer exists.' });
  }

  // Read receipt: opening the quote link IS the "viewed" event. Only for quotes
  // actually sent, and best-effort so tracking can never break the page.
  if (estimate.status === 'sent') {
    const now = new Date();
    prisma.estimate
      .update({
        where: { id: estimate.id },
        data: { firstViewedAt: estimate.firstViewedAt || now, lastViewedAt: now, viewCount: { increment: 1 } }
      })
      .catch((err) => console.error('[estimate-view] tracking failed:', err.message));
  }

  res.json(toSummary(estimate));
});

// POST /api/estimate/:token/respond — the client accepts or declines.
// Nothing is emailed to the client here; instead the workspace is notified in
// the feed, and (best-effort, same as payment receipts) by email.
router.post('/:token/respond', async (req, res) => {
  const schema = z.object({
    decision: z.enum(['accepted', 'declined']),
    reason: z.string().max(500, 'Reason is too long').optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please choose accept or decline' });

  const estimate = await loadByToken(req.params.token);
  if (!estimate || estimate.status === 'draft') {
    return res.status(404).json({ error: 'This estimate link is not valid or the estimate no longer exists.' });
  }
  // Locked once it's converted (an invoice exists) and once the client has
  // already answered the same way — re-clicking "Accept" shouldn't spam the
  // team with duplicate notifications.
  if (estimate.status === 'converted') {
    return res.status(400).json({ error: 'This estimate has already been turned into an invoice.' });
  }
  if (estimate.status === parsed.data.decision) {
    return res.json({ ok: true, alreadyAnswered: true, status: estimate.status });
  }
  if (estimate.status === 'accepted' || estimate.status === 'declined') {
    return res.status(400).json({ error: 'You have already responded to this estimate.' });
  }

  const { decision, reason } = parsed.data;
  const now = new Date();

  const updated = await prisma.estimate.update({
    where: { id: estimate.id },
    data: {
      status: decision,
      acceptedAt: decision === 'accepted' ? now : null,
      declinedAt: decision === 'declined' ? now : null,
      declinedReason: decision === 'declined' ? reason?.trim() || null : null,
      auditLogs: {
        create: {
          type: decision,
          message: decision === 'declined'
            ? `Client declined${reason?.trim() ? `: ${reason.trim()}` : ''}`
            : 'Client accepted the estimate'
        }
      }
    }
  });

  // This is the event the whole team is waiting on, and it happens outside the
  // app — so notify unconditionally here (no excludeUserId: the person who
  // clicked is the client, not a team member).
  await notifyWorkspace({
    workspaceId: estimate.workspaceId,
    type: decision === 'accepted' ? 'estimate_accepted' : 'estimate_declined',
    title: `Estimate ${decision}`,
    message: `${estimate.estimateNumber} was ${decision} by ${estimate.client.name}`,
    estimateId: estimate.id
  });

  // Heads-up email to the business, best-effort and fire-and-forget: the client's
  // answer is already committed, so a mail failure must never lose it. sendEmail
  // writes the EmailLog row itself, so there is nothing to record here.
  const owner = await prisma.membership.findFirst({
    where: { workspaceId: estimate.workspaceId, role: { in: ['owner', 'admin'] } },
    include: { user: true }
  });
  if (owner?.user?.email) {
    const profile = estimate.workspace.businessProfile;
    const settings = estimate.workspace.settings;
    const { subject, html } = estimateResponseEmail({
      businessName: profile?.businessName || estimate.workspace.name,
      clientName: estimate.client.name,
      estimateNumber: estimate.estimateNumber,
      decision,
      reason: reason?.trim() || '',
      total: Math.round(invoiceTotal(estimate, Number(settings?.defaultTaxRate || 0)) * 100) / 100,
      currency: settings?.currency || 'NPR',
      estimateId: estimate.id,
      declined: decision === 'declined'
    });
    sendEmail({
      workspaceId: estimate.workspaceId,
      userId: owner.userId,
      estimateId: estimate.id,
      type: 'estimate_response',
      to: owner.user.email,
      subject,
      html
    }).catch((err) => console.error('[estimate-view] confirmation email failed:', err.message));
  }

  res.json({ ok: true, status: updated.status });
});

module.exports = router;
