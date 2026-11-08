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

module.exports = { updateStatus, listForListing };
