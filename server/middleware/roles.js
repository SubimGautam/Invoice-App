// Role-based access control on top of requireAuth. req.role is set by the auth
// middleware from the caller's Membership. Usage:
//   router.delete('/:id', requireRole('owner', 'admin'), async (req, res) => { ... });

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!allowed.includes(req.role)) {
      const label = allowed.length > 1 ? allowed.slice(0, -1).join(', ') + ' or ' + allowed[allowed.length - 1] : allowed[0];
      return res.status(403).json({ error: `This action requires the ${label} role` });
    }
    next();
  };
}

module.exports = requireRole;