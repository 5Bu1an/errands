const service = require('./service');
const { STATUSES } = require('./lifecycle');

const MIN_SEATS = 1;
const MAX_SEATS = 6;

function isBlank(value) {
  return typeof value !== 'string' || !value.trim();
}

function optionalText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// Validate the details entered when creating a ride.
function validateRide(body = {}) {
  const errors = {};

  if (isBlank(body.destination)) {
    errors.destination = 'Destination is required';
  }

  const time = new Date(body.time);
  if (body.time == null || body.time === '' || Number.isNaN(time.getTime())) {
    errors.time = 'Date and time are required';
  } else if (time <= new Date()) {
    errors.time = 'Date and time must be in the future';
  }

  const seats = Number(body.seats);
  if (body.seats == null || body.seats === '') {
    errors.seats = 'Number of seats is required';
  } else if (!Number.isInteger(seats) || seats < MIN_SEATS || seats > MAX_SEATS) {
    errors.seats = `Seats must be a whole number from ${MIN_SEATS} to ${MAX_SEATS}`;
  }

  const price = body.price == null || body.price === '' ? 0 : Number(body.price);
  if (!Number.isFinite(price) || price < 0) {
    errors.price = 'Price must be $0 or more';
  }

  if (Object.keys(errors).length > 0) return { errors };

  const destination = body.destination.trim();

  return {
    data: {
      type: 'RIDE',
      title: optionalText(body.title) || `Ride to ${destination}`,
      description: optionalText(body.description),
      pickupLocation: optionalText(body.pickupLocation),
      dropoffText: destination,
      time,
      availableSeats: seats,
      price,
    },
  };
}

// Create a new listing (teammate's feature).
async function create(req, res, next) {
  const { type } = req.body || {};

  if (type !== 'RIDE') {
    return res.status(400).json({ errors: { type: 'Type must be RIDE' } });
  }

  const { errors, data } = validateRide(req.body);
  if (errors) return res.status(400).json({ errors });

  try {
    const listing = await service.createListing(req.user.id, data);
    return res.status(201).json({ listing });
  } catch (err) {
    return next(err);
  }
}

// US-09: View details of a specific listing.
async function getById(req, res, next) {
  try {
    const id = req.params.id;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return res.status(400).json({
        error: 'Invalid listing ID',
      });
    }

    const listing = await service.getById(id);

    if (!listing) {
      return res.status(404).json({
        error: 'Listing not found',
      });
    }

    return res.status(200).json({ listing });
  } catch (err) {
    return next(err);
  }
}

// US-14: Cancel a listing.
async function cancel(req, res, next) {
  try {
    const { id } = req.params;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    const result = await service.cancelListing(id, req.user.id);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({
        error: 'You cannot cancel another user’s listing',
      });
    }

    if (result.error === 'INVALID_STATUS') {
      return res.status(409).json({
        error: 'Listing cannot be cancelled in its current status',
      });
    }

    return res.status(200).json({
      message: 'Listing cancelled successfully',
    });
  } catch (err) {
    return next(err);
  }
}

// US-08: Change a listing's status, following the lifecycle rules.
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(id)) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        errors: { status: `Status must be one of ${STATUSES.join(', ')}` },
      });
    }

    const result = await service.changeStatus(id, req.user.id, status);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (result.error === 'FORBIDDEN') {
      return res.status(403).json({
        error: 'You cannot change another user’s listing',
      });
    }

    if (result.error === 'INVALID_STATUS') {
      return res.status(409).json({
        error: `Listing cannot move from ${result.from} to ${status}`,
      });
    }

    return res.status(200).json({ message: 'Listing status updated', status });
  } catch (err) {
    return next(err);
  }
}

module.exports = { create, validateRide, getById, cancel, updateStatus };