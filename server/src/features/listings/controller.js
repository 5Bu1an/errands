const service = require('./service');

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

module.exports = { create, validateRide, validateTask };
