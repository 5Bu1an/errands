// US-20: Report a user or listing.
const request = require('supertest');

jest.mock('../../lib/supabase', () => ({ auth: { getUser: jest.fn() } }));
jest.mock('../../lib/prisma', () => ({
  listing: { findUnique: jest.fn() },
  user: { findUnique: jest.fn(), upsert: jest.fn() },
  report: { findFirst: jest.fn(), create: jest.fn() }
}));

const supabase = require('../../lib/supabase');
const prisma = require('../../lib/prisma');
const app = require('../../app');
const { validateReport } = require('./controller');

const ME = '660e8400-e29b-41d4-a716-446655440000';
const OTHER = '770e8400-e29b-41d4-a716-446655440000';
const LISTING = '880e8400-e29b-41d4-a716-446655440000';

function post(body) {
  return request(app).post('/reports').set('Authorization', 'Bearer t').send(body);
}

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: ME, email: 'me@lakeheadu.ca' } }, error: null });
  prisma.listing.findUnique.mockResolvedValue({ userId: OTHER });
  prisma.user.findUnique.mockResolvedValue({ id: OTHER });
  prisma.report.findFirst.mockResolvedValue(null);
  prisma.report.create.mockImplementation(({ data }) => ({ id: 'r1', status: 'PENDING', ...data }));
});

test('reports a listing with a trimmed reason', async () => {
  const res = await post({ listingId: LISTING, reason: '  Asking for cash up front  ' });

  expect(res.status).toBe(201);
  expect(prisma.report.create).toHaveBeenCalledWith({
    data: { reporterId: ME, listingId: LISTING, reportedId: null, reason: 'Asking for cash up front' }
  });
  expect(res.body.report.status).toBe('PENDING');
});

test('reports a user', async () => {
  const res = await post({ reportedId: OTHER, reason: 'Rude in chat' });

  expect(res.status).toBe(201);
  expect(prisma.report.create).toHaveBeenCalledWith({
    data: { reporterId: ME, listingId: null, reportedId: OTHER, reason: 'Rude in chat' }
  });
});

test('needs a target and a reason', async () => {
  const res = await post({ reason: '' });

  expect(res.status).toBe(400);
  expect(res.body.errors).toHaveProperty('target');
  expect(res.body.errors).toHaveProperty('reason');
  expect(prisma.report.create).not.toHaveBeenCalled();
});

test('a reason over 500 characters is rejected', () => {
  expect(validateReport({ listingId: LISTING, reason: 'x'.repeat(501) }).errors).toHaveProperty('reason');
});

test('rejects a badly formed ID', async () => {
  const res = await post({ listingId: 'abc', reason: 'spam' });
  expect(res.status).toBe(400);
  expect(res.body.errors).toHaveProperty('listingId');
});

test('cannot report yourself', async () => {
  const res = await post({ reportedId: ME, reason: 'test' });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('You cannot report yourself');
});

test('cannot report your own listing', async () => {
  prisma.listing.findUnique.mockResolvedValue({ userId: ME });
  const res = await post({ listingId: LISTING, reason: 'test' });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('You cannot report your own listing');
});

test('404 when the listing or user does not exist', async () => {
  prisma.listing.findUnique.mockResolvedValue(null);
  expect((await post({ listingId: LISTING, reason: 'spam' })).status).toBe(404);

  prisma.user.findUnique.mockResolvedValue(null);
  expect((await post({ reportedId: OTHER, reason: 'spam' })).status).toBe(404);
});

test('409 when the same thing is already reported and not resolved', async () => {
  prisma.report.findFirst.mockResolvedValue({ id: 'r0' });

  const res = await post({ listingId: LISTING, reason: 'spam' });

  expect(res.status).toBe(409);
  expect(prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: { reporterId: ME, listingId: LISTING, reportedId: null, status: { not: 'RESOLVED' } }
  }));
  expect(prisma.report.create).not.toHaveBeenCalled();
});

test('requires login', async () => {
  const res = await request(app).post('/reports').send({ listingId: LISTING, reason: 'spam' });
  expect(res.status).toBe(401);
});
