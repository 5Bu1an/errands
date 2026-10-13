const supabase = require('../lib/supabase');

// Rejects requests without a valid token. Attach to any route that needs a logged-in user.
// On success, sets req.user = { id, email } and req.token for the next handler.
module.exports = async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    req.user = { id: data.user.id, email: data.user.email };
    req.token = token;
    return next();
  } catch (err) {
    return next(err);
  }
};