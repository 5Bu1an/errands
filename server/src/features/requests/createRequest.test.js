
jest.mock('../../lib/prisma', () => {
  const prisma = {
    listing: {
      findUnique: jest.fn(),
      updateMany: jest.fn()
    },
    request: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn()
    },
    notification: {
      create: jest.fn()
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn()
  };

  prisma.$transaction.mockImplementation((callback) => callback(prisma));

  return prisma;
});

const prisma = require('../../lib/prisma');
const { createRequest } = require('./service');

const listingId = '880e8400-e29b-41d4-a716-446655440000';
const ownerId = '660e8400-e29b-41d4-a716-446655440000';
const riderId = '770e8400-e29b-41d4-a716-446655440000';

const newRequest = {
  id: '990e8400-e29b-41d4-a716-446655440000',
  listingId,
  requesterId: riderId,
  pickupLocation: 'Avila Centre',
  status: 'PENDING'
};

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

  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  prisma.$queryRaw.mockResolvedValue([{ id: listingId }]);

  prisma.request.findFirst.mockResolvedValue(null);
  prisma.request.count.mockResolvedValue(0);
  prisma.request.create.mockResolvedValue({ ...newRequest });

  prisma.listing.updateMany.mockResolvedValue({ count: 1 });
  prisma.notification.create.mockResolvedValue({});

  mockListing();
});

describe('US-06: Create a request', () => {
  test('creates a pending request with pickup location and note', async () => {
    const result = await createRequest(
      riderId,
      listingId,
      'Avila Centre',
      'Near the main entrance'
    );

    expect(result).toEqual({ request: newRequest });

    expect(prisma.request.create).toHaveBeenCalledWith({
      data: {
        pickupLocation: 'Avila Centre',
        note: 'Near the main entrance',
        listing: {
          connect: { id: listingId }
        },
        requester: {
          connectOrCreate: {
            where: { id: riderId },
            create: { id: riderId }
          }
        }
      }
    });
  });

  test('runs request creation inside a transaction', async () => {
    await createRequest(riderId, listingId, 'Avila Centre', null);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  test('moves an OPEN listing to REQUESTED', async () => {
    await createRequest(riderId, listingId, 'Avila Centre', null);

    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id: listingId, status: 'OPEN' },
      data: { status: 'REQUESTED' }
    });
  });

  test('notifies the listing owner', async () => {
    await createRequest(riderId, listingId, 'Avila Centre', null);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        message: 'You have a new request for your listing "Ride to Walmart".'
      }
    });
  });

  test('rejects a nonexistent listing', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    expect(
      await createRequest(riderId, listingId, 'Avila Centre', null)
    ).toEqual({ error: 'NOT_FOUND' });

    expect(prisma.request.create).not.toHaveBeenCalled();
  });

  test('rejects a listing missing after locking', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    expect(
      await createRequest(riderId, listingId, 'Avila Centre', null)
    ).toEqual({ error: 'NOT_FOUND' });

    expect(prisma.request.create).not.toHaveBeenCalled();
  });

  test('rejects requesting your own listing', async () => {
    expect(
      await createRequest(ownerId, listingId, 'Avila Centre', null)
    ).toEqual({ error: 'OWN_LISTING' });

    expect(prisma.request.create).not.toHaveBeenCalled();
  });

  test.each(['CANCELLED', 'COMPLETED', 'IN_PROGRESS'])(
    'rejects a listing with status %s',
    async (status) => {
      mockListing({ status });

      expect(
        await createRequest(riderId, listingId, 'Avila Centre', null)
      ).toEqual({ error: 'NOT_OPEN' });

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

      expect(
        await createRequest(riderId, listingId, 'Avila Centre', null)
      ).toEqual({ error: 'ALREADY_REQUESTED' });

      expect(prisma.request.create).not.toHaveBeenCalled();
    }
  );

  test('rejects a full ride', async () => {
    mockListing({ availableSeats: 2 });
    prisma.request.count.mockResolvedValue(2);

    expect(
      await createRequest(riderId, listingId, 'Avila Centre', null)
    ).toEqual({ error: 'LISTING_FULL' });

    expect(prisma.request.create).not.toHaveBeenCalled();
  });

  test('rejects a ride with zero available seats', async () => {
    mockListing({ availableSeats: 0 });

    expect(
      await createRequest(riderId, listingId, 'Avila Centre', null)
    ).toEqual({ error: 'LISTING_FULL' });

    expect(prisma.request.create).not.toHaveBeenCalled();
  });

  test('allows another request while seats remain', async () => {
    mockListing({ status: 'REQUESTED', availableSeats: 3 });
    prisma.request.count.mockResolvedValue(1);

    const result = await createRequest(
      riderId,
      listingId,
      'Avila Centre',
      null
    );

    expect(result).toEqual({ request: newRequest });
  });

  test('allows requests on CONFIRMED listings with capacity', async () => {
    mockListing({ status: 'CONFIRMED', availableSeats: 3 });
    prisma.request.count.mockResolvedValue(1);

    const result = await createRequest(
      riderId,
      listingId,
      'Avila Centre',
      null
    );

    expect(result).toEqual({ request: newRequest });
  });

  test('allows a task request when no helper is accepted', async () => {
    mockListing({
      type: 'TASK',
      availableSeats: null
    });

    const result = await createRequest(
      riderId,
      listingId,
      'Avila Centre',
      null
    );

    expect(result).toEqual({ request: newRequest });
  });

  test('rejects a task when a helper is already accepted', async () => {
    mockListing({
      type: 'TASK',
      availableSeats: null
    });

    prisma.request.count.mockResolvedValue(1);

    expect(
      await createRequest(riderId, listingId, 'Avila Centre', null)
    ).toEqual({ error: 'LISTING_FULL' });
  });
});
