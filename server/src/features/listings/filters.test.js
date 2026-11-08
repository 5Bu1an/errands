// US-13: Filter listings by type, time, location and price.
const request = require('supertest');

jest.mock('../../lib/supabase', () => ({
  auth: { getUser: jest.fn() },
}));

jest.mock('../../lib/prisma', () => ({
  listing: { findMany: jest.fn() },
}));

const supabase = require('../../lib/supabase');
const prisma = require('../../lib/prisma');
const app = require('../../app');
const { parseFilters } = require('./controller');
const { buildListingWhere } = require('./service');

const USER = { id: 'abc-123', email: 'sam@example.com' };

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  prisma.listing.findMany.mockResolvedValue([]);
});

function browse(query) {
  return request(app).get('/listings').query(query).set('Authorization', 'Bearer acc');
}

function whereUsed() {
  return prisma.listing.findMany.mock.calls[0][0].where;
}

describe('parseFilters', () => {
  test('no filters gives an empty filter object', () => {
    expect(parseFilters({})).toEqual({ filters: {} });
  });

  test('reads every filter', () => {
    const { filters } = parseFilters({
      type: 'ride',
      from: '2026-11-20T00:00:00Z',
      to: '2026-11-20T23:59:59Z',
      location: '  Walmart ',
      maxPrice: '10',
    });

    expect(filters).toEqual({
      type: 'RIDE',
      from: new Date('2026-11-20T00:00:00Z'),
      to: new Date('2026-11-20T23:59:59Z'),
      location: 'Walmart',
      maxPrice: 10,
    });
  });

  test('ignores empty values', () => {
    expect(parseFilters({ type: '', location: '   ', maxPrice: '' })).toEqual({ filters: {} });
  });

  test.each([
    [{ type: 'BOAT' }, 'type'],
    [{ from: 'not-a-date' }, 'from'],
    [{ to: 'not-a-date' }, 'to'],
    [{ maxPrice: '-5' }, 'maxPrice'],
    [{ maxPrice: 'cheap' }, 'maxPrice'],
    [{ from: '2026-11-21T00:00:00Z', to: '2026-11-20T00:00:00Z' }, 'to'],
  ])('rejects %o', (query, field) => {
    expect(parseFilters(query).errors).toHaveProperty(field);
  });
});

describe('buildListingWhere', () => {
  test('always limits results to OPEN listings', () => {
    expect(buildListingWhere({})).toEqual({ status: 'OPEN' });
  });

  test('combines every filter with AND', () => {
    const from = new Date('2026-11-20T00:00:00Z');
    const to = new Date('2026-11-20T23:59:59Z');

    expect(
      buildListingWhere({ type: 'TASK', from, to, maxPrice: 20, location: 'avila' })
    ).toEqual({
      status: 'OPEN',
      type: 'TASK',
      time: { gte: from, lte: to },
      price: { lte: 20 },
      OR: [
        { pickupLocation: { contains: 'avila', mode: 'insensitive' } },
        { dropoffText: { contains: 'avila', mode: 'insensitive' } },
        { title: { contains: 'avila', mode: 'insensitive' } },
      ],
    });
  });

  test('a max price of $0 still filters', () => {
    expect(buildListingWhere({ maxPrice: 0 }).price).toEqual({ lte: 0 });
  });
});

describe('GET /listings with filters', () => {
  test('"Rides" shows only ride offers', async () => {
    const res = await browse({ type: 'RIDE' });

    expect(res.status).toBe(200);
    expect(whereUsed()).toEqual({ status: 'OPEN', type: 'RIDE' });
  });

  test('"Tasks" shows only task requests', async () => {
    await browse({ type: 'TASK' });

    expect(whereUsed()).toEqual({ status: 'OPEN', type: 'TASK' });
  });

  test('max price $10 and a date are both applied', async () => {
    await browse({
      maxPrice: 10,
      from: '2026-11-20T00:00:00Z',
      to: '2026-11-20T23:59:59Z',
    });

    expect(whereUsed()).toEqual({
      status: 'OPEN',
      price: { lte: 10 },
      time: {
        gte: new Date('2026-11-20T00:00:00Z'),
        lte: new Date('2026-11-20T23:59:59Z'),
      },
    });
  });

  test('returns an empty list when nothing matches (200)', async () => {
    const res = await browse({ location: 'Nowhere' });

    expect(res.status).toBe(200);
    expect(res.body.listings).toEqual([]);
  });

  test('returns 400 for an invalid filter and does not query', async () => {
    const res = await browse({ maxPrice: -1, type: 'BOAT' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('maxPrice');
    expect(res.body.errors).toHaveProperty('type');
    expect(prisma.listing.findMany).not.toHaveBeenCalled();
  });
});
