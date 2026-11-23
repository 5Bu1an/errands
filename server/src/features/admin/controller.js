const service = require('./service');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPORT_STATUSES = ['PENDING', 'REVIEWED', 'RESOLVED'];

// Wraps a handler so async errors go to Express.
const handle = (fn) => (req, res, next) => fn(req, res).catch(next);

const listUsers = handle(async (req, res) => {
  res.json({ users: await service.listUsers() });
});

const listListings = handle(async (req, res) => {
  res.json({ listings: await service.listListings() });
});

const listReports = handle(async (req, res) => {
  const status = req.query.status ? String(req.query.status).toUpperCase() : null;
  if (status && !REPORT_STATUSES.includes(status)) {
    return res.status(400).json({
      errors: { status: `Status must be one of ${REPORT_STATUSES.join(', ')}` }
    });
  }
  return res.json({ reports: await service.listReports(status) });
});

const updateReport = handle(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!UUID.test(id)) return res.status(400).json({ error: 'Invalid report ID' });
  if (!REPORT_STATUSES.includes(status)) {
    return res.status(400).json({
      errors: { status: `Status must be one of ${REPORT_STATUSES.join(', ')}` }
    });
  }

  const result = await service.updateReportStatus(id, status);
  if (result.error) return res.status(404).json({ error: 'Report not found' });
  return res.json({ message: 'Report updated', status });
});

const removeListing = handle(async (req, res) => {
  const { id } = req.params;
  if (!UUID.test(id)) return res.status(400).json({ error: 'Invalid listing ID' });

  const result = await service.removeListing(id);
  if (result.error) return res.status(404).json({ error: 'Listing not found' });
  return res.json({ message: 'Listing removed' });
});

const removeUser = handle(async (req, res) => {
  const { id } = req.params;
  if (!UUID.test(id)) return res.status(400).json({ error: 'Invalid user ID' });

  const result = await service.removeUser(id, req.user.id);
  if (result.error === 'SELF') return res.status(400).json({ error: 'You cannot remove yourself' });
  if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'User not found' });
  if (result.error === 'ADMIN') return res.status(403).json({ error: 'You cannot remove another admin' });
  return res.json({ message: 'User removed' });
});

module.exports = { listUsers, listListings, listReports, updateReport, removeListing, removeUser };
