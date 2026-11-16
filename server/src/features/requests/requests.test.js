
// US-08 / US-07: Request lifecycle, permissions, and capacity tests.
jest.mock('../../lib/prisma', () => {
  const prisma = {
    request: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn()
    },
    listing: {
      updateMany: jest.fn()
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
const { STATUSES, canTransition } = require('./lifecycle');
const { changeStatus } = require('./service');

const id = '550e8400-e29b-41d4-a716-446655440000';
const listingId = '880e8400-e29b-41d4-a716-446655440000';
const ownerId = '660e8400-e29b-41d4-a716-446655440000';
const requesterId = '770e8400-e29b-41d4-a716-446655440000';

const ALLOWED = [
  ['PENDING', 'ACCEPTED'],
  ['PENDING', 'DECLINED'],
  ['PENDING', 'CANCELLED'],
  ['ACCEPTED', 'CANCELLED']
];

const isAllowed = (from, to) =>
  ALLOWED.some(([f, t]) => f === from && t === to);

const ALL_PAIRS = STATUSES.flatMap((from) =>
  STATUSES.map((to) => [from, to])
);

const REJECTED = ALL_PAIRS.filter(([from, to]) => !isAllowed(from, to));

const actorFor = (status) =>
  status === 'CANCELLED' ? requesterId : ownerId;

function mockRequest(status, listingStatus = 'OPEN', overrides = {}) {
  const request = {
    id,
    listingId,
    requesterId,
    status,
    listing: {
      userId: ownerId,
      status: listingStatus,
      title: 'Ride to Walmart',
      type: 'RIDE',
      availableSeats: 2,
      ...overrides
    }
  };

  // First lookup finds the listing ID; second lookup reads the request
  // after acquiring the listing lock.
  prisma.request.findUnique
    .mockResolvedValueOnce({ listingId })
    .mockResolvedValueOnce(request);
}

beforeEach(() => {
  jest.clearAllMocks();

  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  prisma.$queryRaw.mockResolvedValue([{ id: listingId }]);

  prisma.request.count.mockResolvedValue(0);
  prisma.request.findMany.mockResolvedValue([]);
  prisma.request.updateMany.mockResolvedValue({ count: 1 });
  prisma.listing.updateMany.mockResolvedValue({ count: 1 });
  prisma.notification.create.mockResolvedValue({});
});

describe('request transition rules', () => {
  test.each(ALLOWED)('%s -> %s is allowed', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  test.each(REJECTED)('%s -> %s is rejected', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe('changeStatus', () => {
  test.each(ALLOWED)(
    'saves a valid move %s -> %s',
    async (from, to) => {
      mockRequest(from);

      expect(await changeStatus(id, actorFor(to), to)).toEqual({
        success: true
      });

      expect(prisma.request.updateMany).toHaveBeenCalledWith({
        where: { id, status: from },
        data: { status: to }
      });
    }
  );

  test.each(REJECTED.filter(([, to]) => to !== 'PENDING'))(
    'rejects %s -> %s without saving',
    async (from, to) => {
      mockRequest(from);

      expect(await changeStatus(id, actorFor(to), to)).toEqual({
        error: 'INVALID_STATUS',
        from
      });

      expect(prisma.request.updateMany).not.toHaveBeenCalled();
    }
  );

  test.each(['COMPLETED', 'CANCELLED'])(
    'rejects changes once the listing is %s',
    async (listingStatus) => {
      mockRequest('PENDING', listingStatus);

      expect(await changeStatus(id, ownerId, 'ACCEPTED')).toEqual({
        error: 'INVALID_STATUS',
        from: 'PENDING'
      });

      expect(prisma.request.updateMany).not.toHaveBeenCalled();
    }
  );

  test('nobody can move a request back to PENDING', async () => {
    mockRequest('ACCEPTED');

    expect(await changeStatus(id, ownerId, 'PENDING')).toEqual({
      error: 'FORBIDDEN'
    });

    mockRequest('ACCEPTED');

    expect(await changeStatus(id, requesterId, 'PENDING')).toEqual({
      error: 'FORBIDDEN'
    });

    expect(prisma.request.updateMany).not.toHaveBeenCalled();
  });

  test('requester cannot accept their own request', async () => {
    mockRequest('PENDING');

    expect(await changeStatus(id, requesterId, 'ACCEPTED')).toEqual({
      error: 'FORBIDDEN'
    });
  });

  test('listing owner cannot cancel a request on behalf of requester', async () => {
    mockRequest('PENDING');

    expect(await changeStatus(id, ownerId, 'CANCELLED')).toEqual({
      error: 'FORBIDDEN'
    });
  });

  test('missing request returns NOT_FOUND', async () => {
    prisma.request.findUnique.mockResolvedValueOnce(null);

    expect(await changeStatus(id, ownerId, 'ACCEPTED')).toEqual({
      error: 'NOT_FOUND'
    });

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test('missing listing returns NOT_FOUND', async () => {
    prisma.request.findUnique.mockResolvedValueOnce({ listingId });
    prisma.$queryRaw.mockResolvedValue([]);

    expect(await changeStatus(id, ownerId, 'ACCEPTED')).toEqual({
      error: 'NOT_FOUND'
    });
  });

  test('rejects when the request status changes before saving', async () => {
    mockRequest('PENDING');
    prisma.request.updateMany.mockResolvedValue({ count: 0 });

    expect(await changeStatus(id, ownerId, 'ACCEPTED')).toEqual({
      error: 'INVALID_STATUS',
      from: 'PENDING'
    });
  });

  test('rejects acceptance when all seats are occupied', async () => {
    mockRequest('PENDING', 'REQUESTED', { availableSeats: 2 });
    prisma.request.count.mockResolvedValue(2);

    expect(await changeStatus(id, ownerId, 'ACCEPTED')).toEqual({
      error: 'LISTING_FULL'
    });

    expect(prisma.request.updateMany).not.toHaveBeenCalled();
  });

  test('acceptance moves listing to CONFIRMED', async () => {
    mockRequest('PENDING', 'REQUESTED');

    expect(await changeStatus(id, ownerId, 'ACCEPTED')).toEqual({
      success: true
    });

    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: {
        id: listingId,
        status: { in: ['OPEN', 'REQUESTED'] }
      },
      data: { status: 'CONFIRMED' }
    });
  });

  test('accepting the final seat declines other pending requests', async () => {
    mockRequest('PENDING', 'REQUESTED', { availableSeats: 2 });
    prisma.request.count.mockResolvedValue(1);

    prisma.request.findMany.mockResolvedValue([
      {
        id: '990e8400-e29b-41d4-a716-446655440000',
        requesterId: 'aa0e8400-e29b-41d4-a716-446655440000'
      }
    ]);

    expect(await changeStatus(id, ownerId, 'ACCEPTED')).toEqual({
      success: true
    });

    expect(prisma.request.updateMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['990e8400-e29b-41d4-a716-446655440000']
        },
        status: 'PENDING'
      },
      data: { status: 'DECLINED' }
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  test('notifies requester when accepted', async () => {
    mockRequest('PENDING');

    await changeStatus(id, ownerId, 'ACCEPTED');

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: requesterId,
        message: 'Your request for "Ride to Walmart" has been accepted!'
      }
    });
  });

  test('notifies requester when declined', async () => {
    mockRequest('PENDING');

    await changeStatus(id, ownerId, 'DECLINED');

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: requesterId,
        message: 'Your request for "Ride to Walmart" was declined.'
      }
    });
  });

  test('uses a transaction and listing lock', async () => {
    mockRequest('PENDING');

    await changeStatus(id, ownerId, 'ACCEPTED');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
