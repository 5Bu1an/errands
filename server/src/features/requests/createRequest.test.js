
jest.mock('../../lib/prisma', () => ({
  listing: {
    findUnique: jest.fn()
  },
  request: {
    findFirst: jest.fn(),
    create: jest.fn()
  },
  notification: {
    create: jest.fn()
  }
}));

const prisma = require('../../lib/prisma');
const { createRequest } = require('./service');

const userId = '11111111-1111-4111-8111-111111111111';
const ownerId = '22222222-2222-4222-8222-222222222222';
const listingId = '33333333-3333-4333-8333-333333333333';

const listing = {
  id: listingId,
  userId: ownerId,
  type: 'RIDE',
  status: 'OPEN',
  availableSeats: 3,
  title: 'Ride to Walmart'
};

beforeEach(() => {
  jest.clearAllMocks();

  prisma.listing.findUnique.mockResolvedValue({ ...listing });
  prisma.request.findFirst.mockResolvedValue(null);
  prisma.request.create.mockResolvedValue({
    id: '44444444-4444-4444-8444-444444444444',
    listingId,
    requesterId: userId,
    pickupLocation: 'Lakehead University',
    status: 'PENDING'
  });
  prisma.notification.create.mockResolvedValue({});
});

describe('US-06: Request a ride seat', () => {
  test('creates a pending request with typed pickup location', async () => {
    const result = await createRequest(
      userId,
      listingId,
      'Lakehead University',
      'Near the main entrance'
    );

    expect(result.status).toBe('PENDING');

    expect(prisma.request.create).toHaveBeenCalledWith({
      data: {
        listingId,
        requesterId: userId,
        pickupLocation: 'Lakehead University',
        note: 'Near the main entrance',
        status: 'PENDING'
      }
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });

  test('rejects a nonexistent listing', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    const result = await createRequest(
      userId,
      listingId,
      'Campus'
    );

    expect(result).toEqual({ error: 'NOT_FOUND' });
    expect(prisma.request.create).not.toHaveBeenCalled();
  });

  test('rejects requests on own listing', async () => {
    const result = await createRequest(
      ownerId,
      listingId,
      'Campus'
    );

    expect(result).toEqual({ error: 'FORBIDDEN' });
    expect(prisma.request.create).not.toHaveBeenCalled();
  });

  test.each([
    ['CANCELLED', 'RIDE', 3],
    ['COMPLETED', 'RIDE', 3],
    ['OPEN', 'RIDE', 0],
    ['OPEN', 'TASK', 3]
  ])(
    'rejects unavailable listing: %s, %s, %s seats',
    async (status, type, availableSeats) => {
      prisma.listing.findUnique.mockResolvedValue({
        ...listing,
        status,
        type,
        availableSeats
      });

      const result = await createRequest(
        userId,
        listingId,
        'Campus'
      );

      expect(result).toEqual({ error: 'UNAVAILABLE' });
      expect(prisma.request.create).not.toHaveBeenCalled();
    }
  );

  test.each(['PENDING', 'ACCEPTED'])(
    'rejects an existing active request (%s)',
    async (status) => {
      prisma.request.findFirst.mockResolvedValue({
        id: 'existing-request',
        status
      });

      const result = await createRequest(
        userId,
        listingId,
        'Campus'
      );

      expect(result).toEqual({ error: 'DUPLICATE' });
      expect(prisma.request.create).not.toHaveBeenCalled();
    }
  );

  test('notifies the listing owner after creation', async () => {
    await createRequest(userId, listingId, 'Campus');

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        message: 'You have a new request for your listing "Ride to Walmart".'
      }
    });
  });
});
