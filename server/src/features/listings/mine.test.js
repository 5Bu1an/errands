// US-18: GET /listings/mine, the "posted by me" half of the dashboard.
const request = require('supertest');

jest.mock('../../lib/supabase', () => ({
  auth: { getUser: jest.fn() },
}));

jest.mock('../../lib/prisma', () => ({
  listing: { findMany: jest.fn(), findUnique: jest.fn() },
}));

const supabase = require('../../lib/supabase');
const prisma = require('../../lib/prisma');
const app = require('../../app');

const USER = { id: '660e8400-e29b-41d4-a716-446655440000', email: 'sam@example.com' };

function getMine(token = 'acc') {
  const req = request(app).get('/listings/mine');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

beforeEach(() => {
  jest.resetAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
});

describe('GET /listings/mine (US-18)', () => {
  test('401 without a token, and the database is not touched', async () => {
    const res = await getMine(null);

    expect(res.status).toBe(401);
    expect(prisma.listing.findMany).not.toHaveBeenCalled();
  });

  test('returns only my listings, newest first, counting pending requests', async () => {
    const listings = [
      { id: 'l2', userId: USER.id, type: 'TASK', title: 'Help moving', status: 'REQUESTED', _count: { requests: 2 } },
      { id: 'l1', userId: USER.id, type: 'RIDE', title: 'Ride to Walmart', status: 'OPEN', _count: { requests: 0 } },
    ];
    prisma.listing.findMany.mockResolvedValue(listings);

    const res = await getMine();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ listings });
    expect(prisma.listing.findMany).toHaveBeenCalledWith({
      where: { userId: USER.id },
      orderBy: { time: 'desc' },
      include: { _count: { select: { requests: { where: { status: 'PENDING' } } } } },
    });
  });

  test('includes cancelled and completed listings (not just OPEN ones)', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    await getMine();

    const { where } = prisma.listing.findMany.mock.calls[0][0];
    expect(where).not.toHaveProperty('status');
  });

  test('returns an empty list when I have posted nothing', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    const res = await getMine();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ listings: [] });
  });

  test('is not treated as a listing ID', async () => {
    prisma.listing.findMany.mockResolvedValue([]);

    const res = await getMine();

    expect(res.status).toBe(200);
    expect(prisma.listing.findUnique).not.toHaveBeenCalled();
  });

  test('500 when the database fails', async () => {
    prisma.listing.findMany.mockRejectedValue(new Error('db down'));

    const res = await getMine();

    expect(res.status).toBe(500);
  });
});
