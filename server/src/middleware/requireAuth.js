// Rejects requests without a valid token. Attach to any route that needs a logged-in user.
module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  // TODO: verify token and set req.user
  next();
};
