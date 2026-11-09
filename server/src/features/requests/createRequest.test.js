// US-06: Request a seat with a typed pickup point.
jest.mock('../../lib/prisma', () => ({
  listing: { findUnique: jest.fn(), updateMany: jest.fn() },
  request: { findFirst: jest.fn(), count: jest.fn(), create: jest.fn() },
  notification: { create: jest.fn() }
}));

const prisma = require('../../lib/prisma');
const { createRequest } = require('./service');

const listingId = '880e8400-e29b-41d4-a716-446655440000';
const ownerId = '660e8400-e29b-41d4-a716-446655440000';
const riderId = '770e8400-e29b-41d4-a716-446655440000';

function mockListing(overrides = {}) {
  prisma.listing.findUnique.mockResolvedValue({
    id: listingId,
    userId: ownerId,
    title: 'Ride to Walmart',
    type: 'RIDE',
    status: 'OPEN',
    availableSeats: 2,
    ...overrides
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.request.findFirst.mockResolvedValue(null);
  prisma.request.count.mockResolvedValue(0);
  prisma.request.create.mockResolvedValue({ id: 'new-request', status: 'PENDING' });
});

test('creates a pending request, moves the listing to REQUESTED and notifies the owner', async () => {
  mockListing();

  const result = await createRequest(riderId, listingId, 'Avila Centre', null);

  expect(result).toEqual({ request: { id: 'new-request', status: 'PENDING' } });
  expect(prisma.request.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ pickupLocation: 'Avila Centre', note: null })
  });
  expect(prisma.listing.updateMany).toHaveBeenCalledWith({
    where: { id: listingId, status: 'OPEN' },
    data: { status: 'REQUESTED' }
  });
  expect(prisma.notification.create).toHaveBeenCalledWith({
    data: { userId: ownerId, message: 'You have a new request for your listing "Ride to Walmart".' }
  });
});

test.each([
  ['the listing does not exist', () => prisma.listing.findUnique.mockResolvedValue(null), riderId, 'NOT_FOUND'],
  ['it is your own listing', () => mockListing(), ownerId, 'OWN_LISTING'],
  ['the listing is cancelled', () => mockListing({ status: 'CANCELLED' }), riderId, 'NOT_OPEN'],
  ['the trip already started', () => mockListing({ status: 'IN_PROGRESS' }), riderId, 'NOT_OPEN'],
  [
    'you already requested it',
    () => {
      mockListing();
      prisma.request.findFirst.mockResolvedValue({ id: 'old' });
    },
    riderId,
    'ALREADY_REQUESTED'
  ],
  [
    'every seat is taken',
    () => {
      mockListing({ availableSeats: 1 });
      prisma.request.count.mockResolvedValue(1);
    },
    riderId,
    'LISTING_FULL'
  ]
])('rejects when %s', async (_label, setup, userId, error) => {
  setup();

  expect(await createRequest(userId, listingId, 'Avila Centre', null)).toEqual({ error });
  expect(prisma.request.create).not.toHaveBeenCalled();
});
