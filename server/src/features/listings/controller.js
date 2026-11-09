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

// Checks the date/time and returns it as a Date. Adds to errors if invalid.
function checkFutureTime(value, errors) {
  const time = new Date(value);
  if (value == null || value === '' || Number.isNaN(time.getTime())) {
    errors.time = 'Date and time are required';
  } else if (time <= new Date()) {
    errors.time = 'Date and time must be in the future';
  }
  return time;
}

// Optional amount that defaults to $0. Adds to errors if negative or not a number.
function checkAmount(value, field, label, errors) {
  const amount = value == null || value === '' ? 0 : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    errors[field] = `${label} must be $0 or more`;
  }
  return amount;
}

// Returns { errors } if anything is wrong, otherwise { data } ready to save.
function validateRide(body = {}) {
  const errors = {};

  if (isBlank(body.destination)) {
    errors.destination = 'Destination is required';
  }

  const time = checkFutureTime(body.time, errors);

  const seats = Number(body.seats);
  if (body.seats == null || body.seats === '') {
    errors.seats = 'Number of seats is required';
  } else if (!Number.isInteger(seats) || seats < MIN_SEATS || seats > MAX_SEATS) {
    errors.seats = `Seats must be a whole number from ${MIN_SEATS} to ${MAX_SEATS}`;
  }

  const price = checkAmount(body.price, 'price', 'Price', errors);

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

// A task stores its location in pickupLocation and its compensation in price.
function validateTask(body = {}) {
  const errors = {};

  if (isBlank(body.title)) errors.title = 'Title is required';
  if (isBlank(body.description)) errors.description = 'Description is required';
  if (isBlank(body.location)) errors.location = 'Location is required';

  const time = checkFutureTime(body.time, errors);
  const compensation = checkAmount(body.compensation, 'compensation', 'Compensation', errors);

  if (Object.keys(errors).length > 0) return { errors };

  return {
    data: {
      type: 'TASK',
      title: body.title.trim(),
      description: body.description.trim(),
      pickupLocation: body.location.trim(),
      time,
      price: compensation,
    },
  };
}

const validators = { RIDE: validateRide, TASK: validateTask };

// Create a new ride offer (US-03) or task request (US-04).
async function create(req, res, next) {
  const validate = validators[(req.body || {}).type];
  if (!validate) {
    return res.status(400).json({ errors: { type: 'Type must be RIDE or TASK' } });
  }

  const { errors, data } = validate(req.body);
  if (errors) return res.status(400).json({ errors });

  try {
    const listing = await service.createListing(req.user.id, data);
    return res.status(201).json({ listing });
  } catch (err) {
    return next(err);
  }
}

// US-13: Read the optional browse filters from the query string.
// ?type=RIDE|TASK  ?from=<date>  ?to=<date>  ?location=<text>  ?maxPrice=<number>
// Returns { errors } if a filter is invalid, otherwise { filters }.
function parseFilters(query = {}) {
  const errors = {};
  const filters = {};
  const has = (key) => query[key] != null && query[key] !== '';

  if (has('type')) {
    const type = String(query.type).toUpperCase();
    if (type !== 'RIDE' && type !== 'TASK') {
      errors.type = 'Type must be RIDE or TASK';
    } else {
      filters.type = type;
    }
  }

  for (const key of ['from', 'to']) {
    if (has(key)) {
      const date = new Date(query[key]);
      if (Number.isNaN(date.getTime())) {
        errors[key] = `"${key}" must be a valid date`;
      } else {
        filters[key] = date;
      }
    }
  }

  if (filters.from && filters.to && filters.from > filters.to) {
    errors.to = '"to" must be after "from"';
  }

  if (has('location')) {
    const location = String(query.location).trim();
    if (location) filters.location = location;
  }

  if (has('maxPrice')) {
    const maxPrice = Number(query.maxPrice);
    if (!Number.isFinite(maxPrice) || maxPrice < 0) {
      errors.maxPrice = 'Max price must be $0 or more';
    } else {
      filters.maxPrice = maxPrice;
    }
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { filters };
}

// US-05: Browse open listings. US-13: optional filters.
async function list(req, res, next) {
  const { errors, filters } = parseFilters(req.query);
  if (errors) return res.status(400).json({ errors });

  try {
    const listings = await service.listOpenListings(filters);
    return res.json({ listings });
  } catch (err) {
    return next(err);
  }
}

// US-18: My own listings for the dashboard.
async function listMine(req, res, next) {
  try {
    const listings = await service.listMine(req.user.id);
    return res.json({ listings });
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

module.exports = { create, list, listMine, parseFilters, validateRide, validateTask, getById, cancel, updateStatus };
