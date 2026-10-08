const express = require('express');

const app = express();
app.use(express.json());

// Register each feature here, one line each.
app.use('/auth', require('./features/auth/routes'));
app.use('/listings', require('./features/listings/routes'));
app.use('/requests', require('./features/requests/routes'));

app.get('/health', (req, res) => res.json({ ok: true }));

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`API listening on ${port}`));
}

module.exports = app;
