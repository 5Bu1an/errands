const service = require('./service');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REASON = 500;

const ERRORS = {
  SELF_REPORT: [400, 'You cannot report yourself'],
  OWN_LISTING: [400, 'You cannot report your own listing'],
  LISTING_NOT_FOUND: [404, 'Listing not found'],
  USER_NOT_FOUND: [404, 'User not found'],
  DUPLICATE: [409, 'You already reported this and it is still being reviewed']
};

// US-20: Check the report body. Returns { errors } or { data }.
function validateReport(body = {}) {
  const errors = {};
  const data = { listingId: null, reportedId: null };

  for (const field of ['listingId', 'reportedId']) {
    const value = body[field];
    if (value == null || value === '') continue;
    if (typeof value !== 'string' || !UUID.test(value)) {
      errors[field] = `${field} must be a valid ID`;
    } else {
      data[field] = value;
    }
  }

  if (!errors.listingId && !errors.reportedId && !data.listingId && !data.reportedId) {
    errors.target = 'Choose a listing or a user to report';
  }

  if (typeof body.reason !== 'string' || !body.reason.trim()) {
    errors.reason = 'Reason is required';
  } else if (body.reason.trim().length > MAX_REASON) {
    errors.reason = `Reason must be ${MAX_REASON} characters or less`;
  } else {
    data.reason = body.reason.trim();
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { data };
}

async function create(req, res, next) {
  const { errors, data } = validateReport(req.body);
  if (errors) return res.status(400).json({ errors });

  try {
    const result = await service.createReport(req.user.id, data);
    if (result.error) {
      const [status, error] = ERRORS[result.error];
      return res.status(status).json({ error });
    }
    return res.status(201).json({ report: result.report });
  } catch (err) {
    return next(err);
  }
}

module.exports = { create, validateReport };
