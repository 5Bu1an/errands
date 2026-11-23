const prisma = require('../lib/prisma');

// US-19: Use after requireAuth. Lets the request through only when the
// logged-in user has users.is_admin = true.
module.exports = async function requireAdmin(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isAdmin: true }
    });
    if (!user?.isAdmin) return res.status(403).json({ error: 'Admins only' });
    return next();
  } catch (err) {
    return next(err);
  }
};
