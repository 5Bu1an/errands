// US-23: Recurring rides. "Repeat weekly" creates one ride per week up to the end date.
const request = require('supertest');

jest.mock('../../lib/supabase', () => ({
  auth: { getUser: jest.fn() },
}));

jest.mock('../../lib/prisma', () => {
  const mockPrisma = {
    listing: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  // Prisma has two kinds of transaction: a list of queries, or a function.
  mockPrisma.$transaction = jest.fn((work) =>
    typeof work === 'function' ? work(mockPrisma) : Promise.all(work)
  );
  return mockPrisma;
});

const supabase = require('../../lib/supabase');
const prisma = require('../../lib/prisma');
const app = require('../../app');

const USER = { id: '660e8400-e29b-41d4-a716-446655440000', email: 'driver@example.com' };
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// First ride: 3 days from now at 17:00 UTC, so it is always in the future.
const FIRST = new Date(Date.now() + 3 * DAY_MS);
FIRST.setUTCHours(17, 0, 0, 0);
const weeksAfterFirst = (weeks) => new Date(FIRST.getTime() + weeks * WEEK_MS);

const RIDE = {
  type: 'RIDE',
  destination: 'Walmart',
  pickupLocation: 'Avila Centre',
  time: FIRST.toISOString(),
  seats: 3,
  price: 5,
};

function postRide(body, token = 'acc') {
  const req = request(app).post('/listings');
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send(body);
}

// Each saved ride gets a made-up UUID: ...000, ...001, ...
function dbSavesRides() {
  let n = 0;
  prisma.listing.create.mockImplementation(async ({ data }) => {
    const id = `550e8400-e29b-41d4-a716-${String(n++).padStart(12, '0')}`;
    const { user, ...fields } = data;
    return { id, userId: USER.id, ...fields };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  dbSavesRides();
});

describe('US-23 AC-1: a ride is created for each week up to the end date', () => {
  test('repeating until 3 weeks later creates 4 rides, one week apart, with the same details', async () => {
    const res = await postRide({
      ...RIDE,
      repeatWeekly: true,
      repeatUntil: weeksAfterFirst(3).toISOString(),
    });

    expect(res.status).toBe(201);
    expect(res.body.listings).toHaveLength(4);
    expect(res.body.listing).toEqual(res.body.listings[0]);

    const times = res.body.listings.map((ride) => new Date(ride.time).getTime());
    expect(times).toEqual([0, 1, 2, 3].map((w) => weeksAfterFirst(w).getTime()));

    for (const ride of res.body.listings) {
      expect(ride).toMatchObject({
        type: 'RIDE',
        title: 'Ride to Walmart',
        dropoffText: 'Walmart',
        pickupLocation: 'Avila Centre',
        availableSeats: 3,
        price: 5,
        status: 'OPEN',
      });
    }

    // All saved together, so it is all or nothing.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test('a plain end date includes a ride later that same day', async () => {
    // FIRST is at 17:00, so "2 weeks later" as a date must still include that 17:00 ride.
    const endDate = weeksAfterFirst(2).toISOString().slice(0, 10);

    const res = await postRide({ ...RIDE, repeatWeekly: true, repeatUntil: endDate });

    expect(res.status).toBe(201);
    expect(res.body.listings).toHaveLength(3);
  });
});

describe('US-23 AC-2: cancelling one ride in the series only cancels that week', () => {
  test('cancel updates only the chosen ride', async () => {
    const created = await postRide({
      ...RIDE,
      repeatWeekly: true,
      repeatUntil: weeksAfterFirst(3).toISOString(),
    });
    const secondWeek = created.body.listings[1];

    prisma.listing.findUnique.mockResolvedValue({ ...secondWeek, status: 'OPEN' });
    prisma.listing.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .patch(`/listings/${secondWeek.id}/cancel`)
      .set('Authorization', 'Bearer acc');

    expect(res.status).toBe(200);
    expect(prisma.listing.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id: secondWeek.id, userId: USER.id, status: 'OPEN' },
      data: { status: 'CANCELLED' },
    });
  });
});

describe('US-23 rules', () => {
  test('ticked with no end date: 400, nothing saved', async () => {
    const res = await postRide({ ...RIDE, repeatWeekly: true });

    expect(res.status).toBe(400);
    expect(res.body.errors.repeatUntil).toBe('End date is required for a weekly ride');
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  test('end date less than a week after the first ride: 400, nothing saved', async () => {
    const res = await postRide({
      ...RIDE,
      repeatWeekly: true,
      repeatUntil: new Date(FIRST.getTime() + 6 * DAY_MS).toISOString(),
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.repeatUntil).toBe('End date must be at least one week after the first ride');
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  test('end date more than 12 weeks after the first ride: 400, nothing saved', async () => {
    const res = await postRide({
      ...RIDE,
      repeatWeekly: true,
      repeatUntil: weeksAfterFirst(13).toISOString(),
    });

    expect(res.status).toBe(400);
    expect(res.body.errors.repeatUntil).toBe('Rides can repeat for up to 12 weeks');
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  test('a past first ride only reports the time error, not a repeat error', async () => {
    const res = await postRide({
      ...RIDE,
      time: new Date(Date.now() - DAY_MS).toISOString(),
      repeatWeekly: true,
      repeatUntil: weeksAfterFirst(2).toISOString(),
    });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ time: 'Date and time must be in the future' });
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });
});

describe('US-23 does not change normal rides', () => {
  test('without "Repeat weekly", exactly one ride is created as before', async () => {
    const res = await postRide(RIDE);

    expect(res.status).toBe(201);
    expect(res.body.listing.dropoffText).toBe('Walmart');
    expect(res.body).not.toHaveProperty('listings');
    expect(prisma.listing.create).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('logged out: 401, nothing saved', async () => {
    const res = await postRide(
      { ...RIDE, repeatWeekly: true, repeatUntil: weeksAfterFirst(3).toISOString() },
      null
    );

    expect(res.status).toBe(401);
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });
});
