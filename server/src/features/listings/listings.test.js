
const request = require('supertest');

// Mock Supabase and Prisma so tests don't need real credentials.
jest.mock('../../lib/supabase', () => ({
  auth: { getUser: jest.fn() },
}));

jest.mock('../../lib/prisma', () => ({
  listing: {
    create: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const supabase = require('../../lib/supabase');
const prisma = require('../../lib/prisma');
const app = require('../../app');

const USER = { id: 'abc-123', email: 'sam@example.com' };
const LISTING_ID = '550e8400-e29b-41d4-a716-446655440000';

const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function dbSavesListing() {
  prisma.listing.create.mockImplementation(async ({ data }) => ({
    id: 'listing-1',
    ...data,
  }));
}

function postListing(body) {
  return request(app)
    .post('/listings')
    .set('Authorization', 'Bearer acc')
    .send(body);
}

beforeEach(() => {
  jest.resetAllMocks();
  supabase.auth.getUser.mockResolvedValue({
    data: { user: USER },
    error: null,
  });
});

// Teammate's listing creation tests
describe('POST /listings (ride offer)', () => {
  const ride = {
    type: 'RIDE',
    destination: 'Walmart',
    time: TOMORROW,
    seats: 2,
    price: 5,
  };

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
    expect(Object.keys(res.body.errors).sort()).toEqual([
      'destination',
      'seats',
      'time',
    ]);
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


// US-14: Cancel Listing tests
describe('US-14: Cancel Listing', () => {
  const controller = require('./controller');
  const service = require('./service');

  const listingId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = '660e8400-e29b-41d4-a716-446655440000';

  function mockResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  }

  beforeEach(() => {
    jest.spyOn(service, 'cancelListing');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('successfully cancels a listing', async () => {
    service.cancelListing.mockResolvedValue({ success: true });

    const req = { params: { id: listingId }, user: { id: userId } };
    const res = mockResponse();
    const next = jest.fn();

    await controller.cancel(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(service.cancelListing).toHaveBeenCalledWith(listingId, userId);
  });

  test('rejects cancellation by a different user', async () => {
    service.cancelListing.mockResolvedValue({ error: 'FORBIDDEN' });

    const req = { params: { id: listingId }, user: { id: userId } };
    const res = mockResponse();

    await controller.cancel(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 404 for a missing listing', async () => {
    service.cancelListing.mockResolvedValue({ error: 'NOT_FOUND' });

    const req = { params: { id: listingId }, user: { id: userId } };
    const res = mockResponse();

    await controller.cancel(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('rejects cancellation of a completed listing', async () => {
    service.cancelListing.mockResolvedValue({ error: 'INVALID_STATUS' });

    const req = { params: { id: listingId }, user: { id: userId } };
    const res = mockResponse();

    await controller.cancel(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('rejects an invalid listing ID', async () => {
    const req = { params: { id: 'invalid-id' }, user: { id: userId } };
    const res = mockResponse();

    await controller.cancel(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });
});


// US-09: View Listing Details tests
describe('US-09: View Listing Details', () => {
  test('returns 401 when the user is not logged in', async () => {
    const response = await request(app).get(`/listings/${LISTING_ID}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Not authenticated',
    });
  });

  test('returns 404 when the listing does not exist', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .get(`/listings/${LISTING_ID}`)
      .set('Authorization', 'Bearer fake-test-token');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Listing not found',
    });
  });

  test('returns 400 for an invalid listing ID', async () => {
    const response = await request(app)
      .get('/listings/invalid-id')
      .set('Authorization', 'Bearer fake-test-token');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid listing ID',
    });
  });

  test('returns 200 with listing details', async () => {
    const mockListing = {
      id: LISTING_ID,
      type: 'RIDE',
      title: 'Ride to Walmart',
      description: 'Leaving at 5 PM',
      pickupLocation: 'Lakehead University',
      dropoffText: 'Walmart',
      availableSeats: 3,
      price: 5,
      status: 'OPEN',
      user: {
        id: '456',
        name: 'Alex',
      },
    };

    prisma.listing.findUnique.mockResolvedValue(mockListing);

    const response = await request(app)
      .get(`/listings/${LISTING_ID}`)
      .set('Authorization', 'Bearer fake-test-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      listing: mockListing,
    });
  });
});