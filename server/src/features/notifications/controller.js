const service = require('./service');

async function list(req, res, next) {
  try {
    const notifications = await service.listForUser(req.user.id);
    return res.json({ notifications });
  } catch (err) {
    return next(err);
  }
}

module.exports = { list };
