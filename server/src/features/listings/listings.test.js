const request = require('supertest');

// Fake Supabase (used by requireAuth) and Prisma. Must come before requiring app.
jest.mock('../../lib/supabase', () => ({
  auth: { getUser: jest.fn() },
}));
jest.mock('../../lib/prisma', () => ({
  listing: { create: jest.fn() },
}));

const supabase = require('../../lib/supabase');
const prisma = require('../../lib/prisma');
const app = require('../../app');

const USER = { id: 'abc-123', email: 'sam@example.com' };
const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

// Returns whatever was passed to prisma.listing.create, plus an id.
function dbSavesListing() {
  prisma.listing.create.mockImplementation(async ({ data }) => ({ id: 'listing-1', ...data }));
}

function postListing(body) {
  return request(app).post('/listings').set('Authorization', 'Bearer acc').send(body);
}

beforeEach(() => {
  jest.resetAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
});

describe('POST /listings (ride offer)', () => {
  const ride = { type: 'RIDE', destination: 'Walmart', time: TOMORROW, seats: 2, price: 5 };

  test('saves a valid ride with status OPEN (201)', async () => {
    dbSavesListing();

    const res = await postListing(ride);

    expect(res.status).toBe(201);
    expect(res.body.listing).toMatchObject({
      type: 'RIDE',
      title: 'Ride to Walmart',
      dropoffText: 'Walmart',
      availableSeats: 2,
      price: 5,
      status: 'OPEN',
    });
    const { data } = prisma.listing.create.mock.calls[0][0];
    expect(data.user.connectOrCreate.where).toEqual({ id: USER.id });
  });

  test('defaults price to $0 when left out', async () => {
    dbSavesListing();

    const res = await postListing({ ...ride, price: undefined });

    expect(res.status).toBe(201);
    expect(res.body.listing.price).toBe(0);
  });

  test('rejects a date/time in the past (400)', async () => {
    const res = await postListing({ ...ride, time: YESTERDAY });

    expect(res.status).toBe(400);
    expect(res.body.errors.time).toBe('Date and time must be in the future');
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  test('flags each empty required field (400)', async () => {
    const res = await postListing({ type: 'RIDE' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['destination', 'seats', 'time']);
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  test.each([0, 7, 2.5, 'abc'])('rejects %p seats (400)', async (seats) => {
    const res = await postListing({ ...ride, seats });

    expect(res.status).toBe(400);
    expect(res.body.errors.seats).toBeDefined();
  });

  test('rejects a negative price (400)', async () => {
    const res = await postListing({ ...ride, price: -1 });

    expect(res.status).toBe(400);
    expect(res.body.errors.price).toBe('Price must be $0 or more');
  });

  test('rejects an unknown listing type (400)', async () => {
    const res = await postListing({ ...ride, type: 'BOAT' });

    expect(res.status).toBe(400);
    expect(res.body.errors.type).toBeDefined();
  });

  test('returns 401 when logged out', async () => {
    const res = await request(app).post('/listings').send(ride);

    expect(res.status).toBe(401);
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });
});
