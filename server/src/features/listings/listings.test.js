
const request = require('supertest');

// Mock Supabase so tests don't need real credentials
jest.mock('../../lib/supabase', () => ({
  auth: {
    getUser: jest.fn()
  }
}));

// Mock Prisma so tests don't need a database connection
jest.mock('../../lib/prisma', () => ({
  listing: {
    findUnique: jest.fn()
  }
}));

const app = require('../../app');

describe('US-09: View Listing Details', () => {
  test('returns 401 when the user is not logged in', async () => {
    const response = await request(app)
      .get('/listings/550e8400-e29b-41d4-a716-446655440000');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Not authenticated'
    });
  });
  
test('returns 404 when the listing does not exist', async () => {
  const supabase = require('../../lib/supabase');
  const prisma = require('../../lib/prisma');

  // Pretend the user is logged in
  supabase.auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: '123',
        email: 'student@example.com'
      }
    },
    error: null
  });

  // Pretend the listing doesn't exist in the database
  prisma.listing.findUnique.mockResolvedValue(null);

  const response = await request(app)
    .get('/listings/550e8400-e29b-41d4-a716-446655440000')
    .set('Authorization', 'Bearer fake-test-token');

  expect(response.status).toBe(404);
  expect(response.body).toEqual({
    error: 'Listing not found'
  });
});

test('returns 400 for an invalid listing ID', async () => {
  const supabase = require('../../lib/supabase');

  supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: '123', email: 'student@example.com' } },
    error: null
  });

  const response = await request(app)
    .get('/listings/invalid-id')
    .set('Authorization', 'Bearer fake-test-token');

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    error: 'Invalid listing ID'
  });
});

test('returns 200 with listing details', async () => {
  const supabase = require('../../lib/supabase');
  const prisma = require('../../lib/prisma');

  supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: '123', email: 'student@example.com' } },
    error: null
  });

  const mockListing = {
    id: '550e8400-e29b-41d4-a716-446655440000',
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
      name: 'Alex'
    }
  };

  prisma.listing.findUnique.mockResolvedValue(mockListing);

  const response = await request(app)
    .get(`/listings/${mockListing.id}`)
    .set('Authorization', 'Bearer fake-test-token');

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    listing: mockListing
  });
});
});
