const request = require('supertest');

// Fake admin client (used by requireAuth + logout)
jest.mock('../../lib/supabase', () => ({
  auth: {
    getUser: jest.fn(),
    admin: { createUser: jest.fn(), signOut: jest.fn() },
  },
}));

// Fake public client factory (used by login)
const mockSignIn = jest.fn();
jest.mock('../../lib/supabasePublic', () => ({
  createPublicClient: () => ({ auth: { signInWithPassword: mockSignIn } }),
}));

const supabase = require('../../lib/supabase');
const app = require('../../app');

const USER = { id: 'abc-123', email: 'sam@example.com' };

// Makes the fake getUser accept any token as USER
function tokenIsValid() {
  supabase.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('POST /auth/login', () => {
  test('returns tokens and user for correct credentials (200)', async () => {
    mockSignIn.mockResolvedValue({
      data: {
        session: { access_token: 'acc', refresh_token: 'ref', expires_at: 999 },
        user: USER,
      },
      error: null,
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: ' Sam@Example.com ', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accessToken: 'acc',
      refreshToken: 'ref',
      expiresAt: 999,
      user: USER,
    });
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'sam@example.com', password: 'password123' });
  });

  test('returns "Invalid email or password" for wrong credentials (401)', async () => {
    mockSignIn.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'invalid_credentials', status: 400 },
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'sam@example.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  test('rejects missing fields (400) without calling Supabase', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'sam@example.com' });

    expect(res.status).toBe(400);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  test('returns 500 when Supabase fails unexpectedly', async () => {
    mockSignIn.mockResolvedValue({
      data: { session: null, user: null },
      error: { code: 'unexpected_failure', status: 500 },
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'sam@example.com', password: 'password123' });

    expect(res.status).toBe(500);
  });
});

describe('requireAuth (via GET /auth/me)', () => {
  test('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  test('returns 401 when header is not "Bearer <token>"', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'acc');

    expect(res.status).toBe(401);
  });

  test('returns 401 when Supabase rejects the token', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    });

    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer expired');

    expect(res.status).toBe(401);
  });

  test('returns the user for a valid token (200)', async () => {
    tokenIsValid();

    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer acc');

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(USER);
    expect(supabase.auth.getUser).toHaveBeenCalledWith('acc');
  });
});

describe('POST /auth/logout', () => {
  test('signs out this session only (204)', async () => {
    tokenIsValid();
    supabase.auth.admin.signOut.mockResolvedValue({ error: null });

    const res = await request(app).post('/auth/logout').set('Authorization', 'Bearer acc');

    expect(res.status).toBe(204);
    expect(supabase.auth.admin.signOut).toHaveBeenCalledWith('acc', 'local');
  });

  test('returns 401 when logged out, without calling signOut', async () => {
    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(401);
    expect(supabase.auth.admin.signOut).not.toHaveBeenCalled();
  });
});