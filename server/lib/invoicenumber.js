const prisma = require('../prisma');

// Generate a unique invoice number per WORKSPACE using an atomic counter.
// WorkspaceSettings.nextInvoiceNumber is incremented atomically so two
// concurrent requests can never receive the same value.
async function generateInvoiceNumber(workspaceId) {
  const settings = await prisma.workspaceSettings.upsert({
    where: { workspaceId },
    update: {},
    create: { workspaceId }
  });

  const updated = await prisma.workspaceSettings.update({
    where: { workspaceId },
    data: { nextInvoiceNumber: { increment: 1 } }
  });

  const numberToUse = updated.nextInvoiceNumber - 1;
  return `${settings.invoicePrefix}${String(numberToUse).padStart(4, '0')}`;
}

module.exports = generateInvoiceNumber;