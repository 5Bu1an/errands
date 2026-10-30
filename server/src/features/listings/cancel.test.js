jest.mock('../../lib/prisma', () => ({
  listing: {
    findUnique: jest.fn(),
    updateMany: jest.fn()
  }
}));

const prisma = require('../../lib/prisma');
const { cancelListing } = require('./service');

const id = '550e8400-e29b-41d4-a716-446655440000';
const ownerId = '660e8400-e29b-41d4-a716-446655440000';

beforeEach(() => {
  jest.clearAllMocks();
});

test('owner can cancel an open listing', async () => {
  prisma.listing.findUnique.mockResolvedValue({
    id,
    userId: ownerId,
    status: 'OPEN'
  });
  prisma.listing.updateMany.mockResolvedValue({ count: 1 });

  expect(await cancelListing(id, ownerId)).toEqual({ success: true });
  expect(prisma.listing.updateMany).toHaveBeenCalledWith({
    where: { id, userId: ownerId, status: 'OPEN' },
    data: { status: 'CANCELLED' }
  });
});

test('non-owner cannot cancel listing', async () => {
  prisma.listing.findUnique.mockResolvedValue({
    id,
    userId: ownerId,
    status: 'OPEN'
  });

  expect(await cancelListing(id, 'another-user')).toEqual({
    error: 'FORBIDDEN'
  });
  expect(prisma.listing.updateMany).not.toHaveBeenCalled();
});

test('missing listing returns NOT_FOUND', async () => {
  prisma.listing.findUnique.mockResolvedValue(null);

  expect(await cancelListing(id, ownerId)).toEqual({
    error: 'NOT_FOUND'
  });
});

test.each(['COMPLETED', 'CANCELLED'])(
  'cannot cancel a %s listing',
  async (status) => {
    prisma.listing.findUnique.mockResolvedValue({
      id,
      userId: ownerId,
      status
    });

    expect(await cancelListing(id, ownerId)).toEqual({
      error: 'INVALID_STATUS',
      from: status
    });
    expect(prisma.listing.updateMany).not.toHaveBeenCalled();
  }
);

test('handles concurrent status changes', async () => {
  prisma.listing.findUnique.mockResolvedValue({
    id,
    userId: ownerId,
    status: 'OPEN'
  });
  prisma.listing.updateMany.mockResolvedValue({ count: 0 });

  expect(await cancelListing(id, ownerId)).toEqual({
    error: 'INVALID_STATUS',
    from: 'OPEN'
  });
});