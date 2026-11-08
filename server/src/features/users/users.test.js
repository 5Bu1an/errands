// US-12: View and edit my profile.
const request = require('supertest');

jest.mock('../../lib/supabase', () => ({ auth: { getUser: jest.fn() } }));
jest.mock('../../lib/prisma', () => ({ user: { upsert: jest.fn() } }));

const supabase = require('../../lib/supabase');
const prisma = require('../../lib/prisma');
const app = require('../../app');
const { validateProfile } = require('./controller');

const USER = { id: '660e8400-e29b-41d4-a716-446655440000', email: 'sam@lakeheadu.ca' };

beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
});

test('GET /users/me returns my profile with my email', async () => {
  prisma.user.upsert.mockResolvedValue({ id: USER.id, name: 'Sam', program: null, bio: null });

  const res = await request(app).get('/users/me').set('Authorization', 'Bearer t');

  expect(res.status).toBe(200);
  expect(res.body.profile).toEqual(expect.objectContaining({ name: 'Sam', email: USER.email }));
});

test('PATCH /users/me saves the trimmed fields', async () => {
  prisma.user.upsert.mockResolvedValue({ id: USER.id, name: 'Sam', program: 'CS', bio: 'Hi' });

  const res = await request(app)
    .patch('/users/me')
    .set('Authorization', 'Bearer t')
    .send({ name: '  Sam ', program: 'CS', bio: 'Hi' });

  expect(res.status).toBe(200);
  expect(prisma.user.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ update: { name: 'Sam', program: 'CS', bio: 'Hi' } })
  );
});

test('PATCH /users/me rejects an empty name', async () => {
  const res = await request(app)
    .patch('/users/me')
    .set('Authorization', 'Bearer t')
    .send({ name: '   ' });

  expect(res.status).toBe(400);
  expect(res.body.errors).toHaveProperty('name');
  expect(prisma.user.upsert).not.toHaveBeenCalled();
});

test('a bio over 300 characters is rejected', () => {
  expect(validateProfile({ name: 'Sam', bio: 'x'.repeat(301) }).errors).toHaveProperty('bio');
});

test('requires login', async () => {
  const res = await request(app).get('/users/me');
  expect(res.status).toBe(401);
});
