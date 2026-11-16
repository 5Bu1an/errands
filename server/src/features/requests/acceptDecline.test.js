
// US-07: Accept or decline a request.

jest.mock('../../lib/prisma', () => ({
  request: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn()
  },
  listing: {
    findUnique: jest.fn(),
    updateMany: jest.fn()
  },
  notification: {
    create: jest.fn()
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn()
}));

const prisma = require('../../lib/prisma');
const { changeStatus, getListingRequests } = require('./service');

const requestId = '550e8400-e29b-41d4-a716-446655440000';
const listingId = '880e8400-e29b-41d4-a716-446655440000';
const ownerId = '660e8400-e29b-41d4-a716-446655440000';
const riderId = '770e8400-e29b-41d4-a716-446655440000';
const outsiderId = '990e8400-e29b-41d4-a716-446655440000';

function mockRequest({
  listingStatus = 'REQUESTED',
  type = 'RIDE',
  seats = 2
} = {}) {
  prisma.request.findUnique
    .mockResolvedValueOnce({ listingId })
    .mockResolvedValueOnce({
      id: requestId,
      listingId,
      requesterId: riderId,
      status: 'PENDING',
      listing: {
        userId: ownerId,
        status: listingStatus,
        title: 'Ride to Walmart',
        type,
        availableSeats: type === 'RIDE' ? seats : null
      }
    });
}

beforeEach(() => {
  jest.clearAllMocks();

  // Simulate Prisma interactive transactions.
  prisma.$transaction.mockImplementation((callback) => callback(prisma));

  // Simulate successfully locking the listing row.
  prisma.$queryRaw.mockResolvedValue([{ id: listingId }]);

  prisma.request.updateMany.mockResolvedValue({ count: 1 });
  prisma.request.count.mockResolvedValue(0);
  prisma.request.findMany.mockResolvedValue([]);
  prisma.listing.updateMany.mockResolvedValue({ count: 1 });
  prisma.notification.create.mockResolvedValue({});
});

describe('accepting a request', () => {
  test('marks the request ACCEPTED and the listing CONFIRMED', async () => {
    mockRequest();

    expect(await changeStatus(requestId, ownerId, 'ACCEPTED')).toEqual({
      success: true
    });

    expect(prisma.request.updateMany).toHaveBeenCalledWith({
      where: { id: requestId, status: 'PENDING' },
      data: { status: 'ACCEPTED' }
    });

    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: {
        id: listingId,
        status: { in: ['OPEN', 'REQUESTED'] }
      },
      data: { status: 'CONFIRMED' }
    });
  });

  test('notifies the rider that they were accepted', async () => {
    mockRequest();

    await changeStatus(requestId, ownerId, 'ACCEPTED');

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: riderId,
        message: 'Your request for "Ride to Walmart" has been accepted!'
      }
    });
  });

  test('rejects when every seat is already taken', async () => {
    mockRequest({ seats: 2 });
    prisma.request.count.mockResolvedValue(2);

    expect(await changeStatus(requestId, ownerId, 'ACCEPTED')).toEqual({
      error: 'LISTING_FULL'
    });

    expect(prisma.request.updateMany).not.toHaveBeenCalled();
  });

  test('a task only takes one helper', async () => {
    mockRequest({ type: 'TASK' });
    prisma.request.count.mockResolvedValue(1);

    expect(await changeStatus(requestId, ownerId, 'ACCEPTED')).toEqual({
      error: 'LISTING_FULL'
    });
  });

  test('declines the other pending requests once the last seat is taken', async () => {
    mockRequest({ seats: 2 });

    prisma.request.count.mockResolvedValue(1);

    prisma.request.findMany.mockResolvedValue([
      { id: 'other-1', requesterId: 'rider-2' },
      { id: 'other-2', requesterId: 'rider-3' }
    ]);

    await changeStatus(requestId, ownerId, 'ACCEPTED');

    expect(prisma.request.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: { in: ['other-1', 'other-2'] },
        status: 'PENDING'
      },
      data: { status: 'DECLINED' }
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'rider-2',
        message: '"Ride to Walmart" is now full, so your request was declined.'
      }
    });
  });

  test('keeps other requests pending while seats are still free', async () => {
    mockRequest({ seats: 3 });
    prisma.request.count.mockResolvedValue(0);

    await changeStatus(requestId, ownerId, 'ACCEPTED');

    expect(prisma.request.findMany).not.toHaveBeenCalled();
    expect(prisma.request.updateMany).toHaveBeenCalledTimes(1);
  });

  test('cannot accept once the trip is in progress', async () => {
    mockRequest({ listingStatus: 'IN_PROGRESS' });

    expect(await changeStatus(requestId, ownerId, 'ACCEPTED')).toEqual({
      error: 'INVALID_STATUS',
      from: 'PENDING'
    });

    expect(prisma.request.updateMany).not.toHaveBeenCalled();
  });
});

describe('declining a request', () => {
  test('marks the request DECLINED and leaves the listing alone', async () => {
    mockRequest();

    expect(await changeStatus(requestId, ownerId, 'DECLINED')).toEqual({
      success: true
    });

    expect(prisma.request.updateMany).toHaveBeenCalledWith({
      where: { id: requestId, status: 'PENDING' },
      data: { status: 'DECLINED' }
    });

    expect(prisma.listing.updateMany).not.toHaveBeenCalled();
  });

  test('notifies the rider that they were declined', async () => {
    mockRequest();

    await changeStatus(requestId, ownerId, 'DECLINED');

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: riderId,
        message: 'Your request for "Ride to Walmart" was declined.'
      }
    });
  });

  test('someone who is not the owner cannot decline', async () => {
    mockRequest();

    expect(await changeStatus(requestId, outsiderId, 'DECLINED')).toEqual({
      error: 'FORBIDDEN'
    });

    expect(prisma.request.updateMany).not.toHaveBeenCalled();
  });
});

describe('getListingRequests', () => {
  test('returns the requests for the owner', async () => {
    const requests = [
      {
        id: requestId,
        status: 'PENDING',
        requester: { id: riderId, name: 'Sam' }
      }
    ];

    prisma.listing.findUnique.mockResolvedValue({
      userId: ownerId
    });

    prisma.request.findMany.mockResolvedValue(requests);

    expect(await getListingRequests(listingId, ownerId)).toEqual({
      requests
    });

    expect(prisma.request.findMany).toHaveBeenCalledWith({
      where: { listingId },
      orderBy: { createdAt: 'asc' },
      include: {
        requester: {
          select: { id: true, name: true }
        }
      }
    });
  });

  test('other users cannot see the requests', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      userId: ownerId
    });

    expect(await getListingRequests(listingId, outsiderId)).toEqual({
      error: 'FORBIDDEN'
    });

    expect(prisma.request.findMany).not.toHaveBeenCalled();
  });

  test('missing listing returns NOT_FOUND', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    expect(await getListingRequests(listingId, ownerId)).toEqual({
      error: 'NOT_FOUND'
    });
  });
});
