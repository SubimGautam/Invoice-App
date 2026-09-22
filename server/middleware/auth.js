const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

// Every authenticated request carries a token minted with { userId,
// workspaceId } = the ACTIVE workspace. We verify the membership still exists
// on every request so removed members lose access immediately (tokens don't
// outlive a kick). The membership also supplies the role used for permission
// gating (requireRole in ./roles.js).
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { userId, workspaceId } = decoded;
    if (!userId || !workspaceId) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } }
    });
    if (!membership) {
      return res.status(401).json({ error: 'You are no longer a member of this workspace' });
    }

    req.userId = userId;
    req.workspaceId = workspaceId;
    req.role = membership.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = requireAuth;