// override: the .env file wins over any DATABASE_URL etc. already set in the shell.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env'), override: true });
const express = require('express');
const cors = require('cors');

const app = express();
// Allowed frontends: local dev plus any deployed URLs listed in CLIENT_ORIGIN
// (comma-separated, e.g. https://errands.vercel.app).
const allowedOrigins = ['http://localhost:5173', ...(process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Register each feature here, one line each.
app.use('/auth', require('./features/auth/routes'));
app.use('/listings', require('./features/listings/routes'));
app.use('/requests', require('./features/requests/routes'));
app.use('/chat', require('./features/chat/routes'));
app.use('/users', require('./features/users/routes'));
app.use('/notifications', require('./features/notifications/routes'));
app.get('/health', (req, res) => res.json({ ok: true }));

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`API listening on ${port}`));
}

module.exports = app;
