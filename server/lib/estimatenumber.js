const prisma = require('../prisma');

// Generate a unique estimate number per WORKSPACE, using its own atomic counter
// (WorkspaceSettings.nextEstimateNumber). Deliberately a separate sequence from
// invoice numbers: quoting a job must never burn an invoice number, and the two
// documents have independent, readable numbering (EST-0001, INV-0007).
async function generateEstimateNumber(workspaceId) {
  const settings = await prisma.workspaceSettings.upsert({
    where: { workspaceId },
    update: {},
    create: { workspaceId }
  });

  const updated = await prisma.workspaceSettings.update({
    where: { workspaceId },
    data: { nextEstimateNumber: { increment: 1 } }
  });

  const numberToUse = updated.nextEstimateNumber - 1;
  return `${settings.estimatePrefix}${String(numberToUse).padStart(4, '0')}`;
}

module.exports = generateEstimateNumber;
