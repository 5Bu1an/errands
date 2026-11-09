
const service = require('./service');
const { STATUSES } = require('./lifecycle');

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CREATE_ERRORS = {
  NOT_FOUND: [404, 'Listing not found'],
  OWN_LISTING: [403, 'You cannot request your own listing'],
  NOT_OPEN: [409, 'This listing is no longer taking requests'],
  ALREADY_REQUESTED: [409, 'You already have a request on this listing'],
  LISTING_FULL: [409, 'This listing is already full']
};

async function create(req, res, next) {
  const { listingId, pickupLocation, note } = req.body || {};

  if (typeof listingId !== 'string' || !uuidPattern.test(listingId)) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  if (
    typeof pickupLocation !== 'string' ||
    !pickupLocation.trim() ||
    pickupLocation.trim().length > 200
  ) {
    return res.status(400).json({
      error: 'Pickup location is required (maximum 200 characters)'
    });
  }

  if (note != null && (typeof note !== 'string' || note.length > 300)) {
    return res.status(400).json({
      error: 'Note must be at most 300 characters'
    });
  }

  try {
    const result = await service.createRequest(
      req.user.id,
      listingId,
      pickupLocation.trim(),
      typeof note === 'string' ? note.trim() : null
    );

    if (result.error) {
      const [code, message] = CREATE_ERRORS[result.error] || [
        500,
        'Unable to create request'
      ];
      return res.status(code).json({ error: message });
    }

    return res.status(201).json({ request: result.request });
  } catch (err) {
    return next(err);
  }
}

async function updateStatus(req, res, next) {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!uuidPattern.test(id)) {
    return res.status(400).json({ error: 'Invalid request ID' });
  }

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid request status' });
  }

  try {
    const result = await service.changeStatus(id, req.user.id, status);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({ error: 'Not allowed to update this request' });
    }

    if (result.error === 'INVALID_STATUS') {
      return res.status(409).json({
        error: 'Invalid request status transition'
      });
    }

    if (result.error === 'LISTING_FULL') {
      return res.status(409).json({ error: 'This listing is already full' });
    }

    return res.status(200).json({
      message: 'Request status updated',
      status
    });
  } catch (err) {
    return next(err);
  }
}

async function listForListing(req, res, next) {
  const { listingId } = req.params;

  if (!uuidPattern.test(listingId)) {
    return res.status(400).json({ error: 'Invalid listing ID' });
  }

  try {
    const result = await service.getListingRequests(
      listingId,
      req.user.id
    );

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({
        error: 'Not allowed to view these requests'
      });
    }

    return res.status(200).json({ requests: result.requests });
  } catch (err) {
    return next(err);
  }
}

async function listMine(req, res, next) {
  try {
    const requests = await service.getMyRequests(req.user.id);
    return res.status(200).json({ requests });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  create,
  updateStatus,
  listForListing,
  listMine
};
