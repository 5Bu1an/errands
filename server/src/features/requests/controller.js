
// Requests controller: validates input, calls the service, and sends responses.
const service = require('./service');
const { STATUSES } = require('./lifecycle');

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// US-08: Change a request's status.
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!uuidPattern.test(id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        errors: {
          status: `Status must be one of ${STATUSES.join(', ')}`
        }
      });
    }

    const result = await service.changeStatus(id, req.user.id, status);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({
        error: 'You are not allowed to change this request'
      });
    }

    if (result.error === 'INVALID_STATUS') {
      return res.status(409).json({
        error: 'Invalid request status transition',
        from: result.from
      });
    }

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

// US-06: Create a seat request with a typed pickup point.
async function create(req, res, next) {
  try {
    const { listingId, pickupLocation, note } = req.body || {};
    const errors = {};

    if (typeof listingId !== 'string' || !uuidPattern.test(listingId)) {
      errors.listingId = 'Valid listing ID is required';
    }

    if (
      typeof pickupLocation !== 'string' ||
      !pickupLocation.trim()
    ) {
      errors.pickupLocation = 'Pickup location is required';
    }

    if (note != null && typeof note !== 'string') {
      errors.note = 'Note must be text';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    const result = await service.createRequest(
      req.user.id,
      listingId,
      pickupLocation.trim(),
      typeof note === 'string' ? note.trim() : null
    );

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({
        error: 'You cannot request a seat on your own listing'
      });
    }

    if (result.error === 'UNAVAILABLE') {
      return res.status(409).json({
        error: 'This ride is not available for requests'
      });
    }

    if (result.error === 'DUPLICATE') {
      return res.status(409).json({
        error: 'You already have an active request for this ride'
      });
    }

    return res.status(201).json({ request: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = { updateStatus, create };