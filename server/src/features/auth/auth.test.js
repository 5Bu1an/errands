const request = require('supertest');

// Swap the real Supabase client for a fake one. Must come before requiring app.
jest.mock('../../lib/supabase', () => ({
  auth: { admin: { createUser: jest.fn() } },
}));

const supabase = require('../../lib/supabase');
const app = require('../../app');

const createUser = supabase.auth.admin.createUser;

beforeEach(() => {
  createUser.mockReset(); // fresh fake before every test
});

describe('POST /auth/signup', () => {
  test('creates an account with a valid email and 8+ char password (201)', async () => {
    createUser.mockResolvedValue({
      data: { user: { id: 'abc-123', email: 'sam@example.com' } },
      error: null,
    });

    const res = await request(app)
      .post('/auth/signup')
      .send({ email: '  Sam@Example.com ', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: 'abc-123', email: 'sam@example.com' });
    // email was trimmed + lowercased before reaching Supabase
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'sam@example.com', password: 'password123' })
    );
  });

  test('rejects an email that is already registered (409)', async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'email_exists', message: 'already registered' },
    });

    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'sam@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.errors.email).toBe('This email is already registered');
  });

  test('rejects an invalid email format (400) without calling Supabase', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBeDefined();
    expect(res.body.errors.password).toBeUndefined();
    expect(createUser).not.toHaveBeenCalled();
  });

  test('rejects a password shorter than 8 characters (400)', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'sam@example.com', password: '1234567' });

    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBeDefined();
    expect(createUser).not.toHaveBeenCalled();
  });

  test('returns both field errors when both are invalid (400)', async () => {
    const res = await request(app).post('/auth/signup').send({});

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['email', 'password']);
  });

  test('returns 500 when Supabase fails unexpectedly', async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'unexpected_failure', message: 'Supabase is down' },
    });

    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'sam@example.com', password: 'password123' });

    expect(res.status).toBe(500);
  });
});