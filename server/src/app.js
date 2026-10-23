require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({
  origin: 'http://localhost:5173'
}));
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
