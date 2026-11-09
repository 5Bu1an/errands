
// Load environment variables from the project root.
require('dotenv').config({
  path: require('path').join(__dirname, '../../.env'),
  override: true
});

const express = require('express');
const cors = require('cors');

const app = express();

// Allow local development and configured deployed frontends.
const allowedOrigins = [
  'http://localhost:5173',
  ...(process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Register feature routes.
app.use('/auth', require('./features/auth/routes'));
app.use('/listings', require('./features/listings/routes'));
app.use('/requests', require('./features/requests/routes'));
app.use('/chat', require('./features/chat/routes'));
app.use('/users', require('./features/users/routes'));
app.use('/notifications', require('./features/notifications/routes'));

// US-11: Trip Progress Tracking
app.use('/listings', require('./features/tracking/routes'));

app.get('/health', (req, res) => res.json({ ok: true }));

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`API listening on ${port}`));
}

module.exports = app;
