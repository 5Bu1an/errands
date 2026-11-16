// US-18: GET /requests/mine, the "requested by me" half of the dashboard.
const request = require('supertest');

jest.mock('../../lib/supabase', () => ({
  auth: { getUser: jest.fn() },
}));

jest.mock('../../lib/prisma', () => ({
  request: { findMany: jest.fn() },
}));

const supabase = require('../../lib/supabase');
const prisma = require('../../lib/prisma');
const app = require('../../app');

const USER = { id: '770e8400-e29b-41d4-a716-446655440000', email: 'alex@example.com' };

function getMine(token = 'acc') {
  const req = request(app).get('/requests/mine');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

beforeEach(() => {
  jest.resetAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
});

describe('GET /requests/mine (US-18)', () => {
  test('401 without a token, and the database is not touched', async () => {
    const res = await getMine(null);

    expect(res.status).toBe(401);
    expect(prisma.request.findMany).not.toHaveBeenCalled();
  });

  test('returns only my requests, newest first, with the listing and its poster', async () => {
    const requests = [
      {
        id: 'r1',
        listingId: 'l1',
        requesterId: USER.id,
        pickupLocation: 'Library',
        status: 'ACCEPTED',
        listing: {
          id: 'l1',
          title: 'Ride to Walmart',
          type: 'RIDE',
          time: '2026-11-20T17:00:00.000Z',
          status: 'CONFIRMED',
          price: 5,
          pickupLocation: 'Campus',
          dropoffText: 'Walmart',
          user: { id: 'owner-1', name: 'Sam' },
        },
      },
    ];
    prisma.request.findMany.mockResolvedValue(requests);

    const res = await getMine();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requests });

    const query = prisma.request.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ requesterId: USER.id });
    expect(query.orderBy).toEqual({ createdAt: 'desc' });
    expect(query.include.listing.select).toMatchObject({
      id: true,
      title: true,
      type: true,
      time: true,
      status: true,
      user: { select: { id: true, name: true } },
    });
  });

  test('does not send the poster\'s private details', async () => {
    prisma.request.findMany.mockResolvedValue([]);

    await getMine();

    const { select } = prisma.request.findMany.mock.calls[0][0].include.listing.select.user;
    expect(Object.keys(select).sort()).toEqual(['id', 'name']);
  });

  test('returns an empty list when I have requested nothing', async () => {
    prisma.request.findMany.mockResolvedValue([]);

    const res = await getMine();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requests: [] });
  });

  test('500 when the database fails', async () => {
    prisma.request.findMany.mockRejectedValue(new Error('db down'));

    const res = await getMine();

    expect(res.status).toBe(500);
  });
});
