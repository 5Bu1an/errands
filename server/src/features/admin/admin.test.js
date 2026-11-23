// US-19: Admin views users and listings, reviews reports, removes content.
const request = require('supertest');

jest.mock('../../lib/supabase', () => ({
  auth: {
    getUser: jest.fn(),
    admin: { listUsers: jest.fn(), deleteUser: jest.fn() }
  }
}));
jest.mock('../../lib/prisma', () => ({
  user: { findUnique: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
  listing: { findUnique: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
  report: { findMany: jest.fn(), updateMany: jest.fn() },
  notification: { create: jest.fn() }
}));

const supabase = require('../../lib/supabase');
const prisma = require('../../lib/prisma');
const app = require('../../app');

const ADMIN = '110e8400-e29b-41d4-a716-446655440000';
const USER = '220e8400-e29b-41d4-a716-446655440000';
const LISTING = '330e8400-e29b-41d4-a716-446655440000';
const REPORT = '440e8400-e29b-41d4-a716-446655440000';

// The first users.findUnique is requireAdmin checking the caller.
function asAdmin(isAdmin = true) {
  prisma.user.findUnique.mockResolvedValueOnce({ isAdmin });
}

const as = (req) => req.set('Authorization', 'Bearer t');

beforeEach(() => {
  jest.resetAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: ADMIN, email: 'admin@lakeheadu.ca' } }, error: null });
  supabase.auth.admin.listUsers.mockResolvedValue({ data: { users: [{ id: USER, email: 'sam@lakeheadu.ca' }] }, error: null });
  supabase.auth.admin.deleteUser.mockResolvedValue({ error: null });
  prisma.notification.create.mockResolvedValue({});
});

describe('access', () => {
  test('requires login', async () => {
    expect((await request(app).get('/admin/users')).status).toBe(401);
  });

  test('regular users get 403', async () => {
    asAdmin(false);
    const res = await as(request(app).get('/admin/users'));
    expect(res.status).toBe(403);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  test('a user with no profile row gets 403', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    expect((await as(request(app).get('/admin/listings'))).status).toBe(403);
  });
});

describe('viewing', () => {
  test('GET /admin/users adds emails from Supabase Auth', async () => {
    asAdmin();
    prisma.user.findMany.mockResolvedValue([{ id: USER, name: 'Sam' }, { id: ADMIN, name: 'Ada' }]);

    const res = await as(request(app).get('/admin/users'));

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([
      { id: USER, name: 'Sam', email: 'sam@lakeheadu.ca' },
      { id: ADMIN, name: 'Ada', email: null }
    ]);
  });

  test('GET /admin/users still works if the email lookup fails', async () => {
    asAdmin();
    prisma.user.findMany.mockResolvedValue([{ id: USER, name: 'Sam' }]);
    supabase.auth.admin.listUsers.mockRejectedValue(new Error('down'));

    const res = await as(request(app).get('/admin/users'));

    expect(res.status).toBe(200);
    expect(res.body.users[0].email).toBeNull();
  });

  test('GET /admin/listings returns listings in every status', async () => {
    asAdmin();
    prisma.listing.findMany.mockResolvedValue([{ id: LISTING, status: 'CANCELLED' }]);

    const res = await as(request(app).get('/admin/listings'));

    expect(res.status).toBe(200);
    expect(res.body.listings).toHaveLength(1);
    expect(prisma.listing.findMany.mock.calls[0][0]).not.toHaveProperty('where');
  });

  test('GET /admin/reports filters by status', async () => {
    asAdmin();
    prisma.report.findMany.mockResolvedValue([]);

    const res = await as(request(app).get('/admin/reports?status=pending'));

    expect(res.status).toBe(200);
    expect(prisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'PENDING' } }));
  });

  test('GET /admin/reports rejects an unknown status', async () => {
    asAdmin();
    expect((await as(request(app).get('/admin/reports?status=nope'))).status).toBe(400);
  });
});

describe('reports', () => {
  test('PATCH /admin/reports/:id marks a report resolved', async () => {
    asAdmin();
    prisma.report.updateMany.mockResolvedValue({ count: 1 });

    const res = await as(request(app).patch(`/admin/reports/${REPORT}`)).send({ status: 'RESOLVED' });

    expect(res.status).toBe(200);
    expect(prisma.report.updateMany).toHaveBeenCalledWith({ where: { id: REPORT }, data: { status: 'RESOLVED' } });
  });

  test('PATCH /admin/reports/:id 404s for a missing report', async () => {
    asAdmin();
    prisma.report.updateMany.mockResolvedValue({ count: 0 });
    const res = await as(request(app).patch(`/admin/reports/${REPORT}`)).send({ status: 'REVIEWED' });
    expect(res.status).toBe(404);
  });

  test('PATCH /admin/reports/:id rejects a bad status', async () => {
    asAdmin();
    const res = await as(request(app).patch(`/admin/reports/${REPORT}`)).send({ status: 'DONE' });
    expect(res.status).toBe(400);
    expect(prisma.report.updateMany).not.toHaveBeenCalled();
  });
});

describe('removing a listing', () => {
  test('deletes it and tells the owner', async () => {
    asAdmin();
    prisma.listing.findUnique.mockResolvedValue({ userId: USER, title: 'Ride to Walmart' });

    const res = await as(request(app).delete(`/admin/listings/${LISTING}`));

    expect(res.status).toBe(200);
    expect(prisma.listing.delete).toHaveBeenCalledWith({ where: { id: LISTING } });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: USER,
        message: 'Your listing "Ride to Walmart" was removed by an admin for breaking the community rules.'
      }
    });
  });

  test('404s when the listing does not exist', async () => {
    asAdmin();
    prisma.listing.findUnique.mockResolvedValue(null);
    expect((await as(request(app).delete(`/admin/listings/${LISTING}`))).status).toBe(404);
    expect(prisma.listing.delete).not.toHaveBeenCalled();
  });

  test('400 for a bad ID', async () => {
    asAdmin();
    expect((await as(request(app).delete('/admin/listings/abc'))).status).toBe(400);
  });
});

describe('removing a user', () => {
  test('deletes their login and their profile', async () => {
    asAdmin();
    prisma.user.findUnique.mockResolvedValueOnce({ isAdmin: false });

    const res = await as(request(app).delete(`/admin/users/${USER}`));

    expect(res.status).toBe(200);
    expect(supabase.auth.admin.deleteUser).toHaveBeenCalledWith(USER);
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: USER } });
  });

  test('cannot remove yourself', async () => {
    asAdmin();
    const res = await as(request(app).delete(`/admin/users/${ADMIN}`));
    expect(res.status).toBe(400);
    expect(supabase.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  test('cannot remove another admin', async () => {
    asAdmin();
    prisma.user.findUnique.mockResolvedValueOnce({ isAdmin: true });
    const res = await as(request(app).delete(`/admin/users/${USER}`));
    expect(res.status).toBe(403);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });

  test('keeps the profile if the login could not be deleted', async () => {
    asAdmin();
    prisma.user.findUnique.mockResolvedValueOnce({ isAdmin: false });
    supabase.auth.admin.deleteUser.mockResolvedValue({ error: { status: 500, message: 'boom' } });

    const res = await as(request(app).delete(`/admin/users/${USER}`));

    expect(res.status).toBe(500);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });
});
