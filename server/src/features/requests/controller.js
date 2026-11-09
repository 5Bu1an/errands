// requests controller: parses the request, calls the service/logic layer, sends the response.
const service = require('./service');
const { STATUSES } = require('./lifecycle');

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// US-08: Change a request's status, following the lifecycle rules.
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!uuidPattern.test(id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        errors: { status: `Status must be one of ${STATUSES.join(', ')}` },
      });
    }

    const result = await service.changeStatus(id, req.user.id, status);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({
        error: 'You are not allowed to make this change',
      });
    }

    if (result.error === 'INVALID_STATUS') {
      return res.status(409).json({
        error: `Request cannot move from ${result.from} to ${status}`,
      });
    }

    if (result.error === 'LISTING_FULL') {
      return res.status(409).json({
        error: 'This listing is already full',
      });
    }

    return res.status(200).json({ message: 'Request status updated', status });
  } catch (err) {
    return next(err);
  }
}

// US-07: List the requests on a listing (listing owner only).
async function listForListing(req, res, next) {
  try {
    const { listingId } = req.params;

    if (!uuidPattern.test(listingId)) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    const result = await service.getListingRequests(listingId, req.user.id);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({
        error: 'Only the listing owner can see its requests',
      });
    }

    return res.status(200).json({ requests: result.requests });
  } catch (err) {
    return next(err);
  }
}

const CREATE_ERRORS = {
  NOT_FOUND: [404, 'Listing not found'],
  OWN_LISTING: [403, 'You cannot request your own listing'],
  NOT_OPEN: [409, 'This listing is no longer taking requests'],
  ALREADY_REQUESTED: [409, 'You already have a request on this listing'],
  LISTING_FULL: [409, 'This listing is already full']
};

// US-06: Request a seat / offer to help, with a typed pickup point.
async function create(req, res, next) {
  const { listingId, pickupLocation, note } = req.body || {};
  const errors = {};

  if (typeof listingId !== 'string' || !uuidPattern.test(listingId)) {
    errors.listingId = 'A valid listing ID is required';
  }
  if (typeof pickupLocation !== 'string' || !pickupLocation.trim()) {
    errors.pickupLocation = 'Pickup point is required';
  } else if (pickupLocation.trim().length > 200) {
    errors.pickupLocation = 'Pickup point must be 200 characters or less';
  }
  if (note != null && (typeof note !== 'string' || note.length > 300)) {
    errors.note = 'Note must be text of 300 characters or less';
  }
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

  try {
    const result = await service.createRequest(
      req.user.id,
      listingId,
      pickupLocation.trim(),
      typeof note === 'string' && note.trim() ? note.trim() : null
    );

    if (result.error) {
      const [code, message] = CREATE_ERRORS[result.error];
      return res.status(code).json({ error: message });
    }

    return res.status(201).json({ request: result.request });
  } catch (err) {
    return next(err);
  }
}

// US-18: The requests I have made.
async function listMine(req, res, next) {
  try {
    const requests = await service.getMyRequests(req.user.id);
    return res.json({ requests });
  } catch (err) {
    return next(err);
  }
}

module.exports = { updateStatus, listForListing, create, listMine };
