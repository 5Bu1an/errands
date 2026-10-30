// US-08: Listing lifecycle rules.
jest.mock('../../lib/prisma', () => ({
  listing: {
    findUnique: jest.fn(),
    updateMany: jest.fn()
  }
}));

const prisma = require('../../lib/prisma');
const { STATUSES, canTransition } = require('./lifecycle');
const { changeStatus } = require('./service');

const id = '550e8400-e29b-41d4-a716-446655440000';
const ownerId = '660e8400-e29b-41d4-a716-446655440000';

const ALLOWED = [
  ['OPEN', 'REQUESTED'],
  ['OPEN', 'CANCELLED'],
  ['REQUESTED', 'CONFIRMED'],
  ['REQUESTED', 'CANCELLED'],
  ['CONFIRMED', 'IN_PROGRESS'],
  ['CONFIRMED', 'CANCELLED'],
  ['IN_PROGRESS', 'COMPLETED'],
  ['IN_PROGRESS', 'CANCELLED']
];
const isAllowed = (from, to) =>
  ALLOWED.some(([f, t]) => f === from && t === to);

const ALL_PAIRS = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to]));
const REJECTED = ALL_PAIRS.filter(([from, to]) => !isAllowed(from, to));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listing transition rules', () => {
  test.each(ALLOWED)('%s -> %s is allowed', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  test.each(REJECTED)('%s -> %s is rejected', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  test.each(['COMPLETED', 'CANCELLED'])('%s is final', (from) => {
    STATUSES.forEach((to) => expect(canTransition(from, to)).toBe(false));
  });
});

describe('changeStatus', () => {
  test.each(ALLOWED)('saves a valid move %s -> %s', async (from, to) => {
    prisma.listing.findUnique.mockResolvedValue({ id, userId: ownerId, status: from });
    prisma.listing.updateMany.mockResolvedValue({ count: 1 });

    expect(await changeStatus(id, ownerId, to)).toEqual({ success: true });
    expect(prisma.listing.updateMany).toHaveBeenCalledWith({
      where: { id, userId: ownerId, status: from },
      data: { status: to }
    });
  });

  test.each(REJECTED)('rejects %s -> %s without saving', async (from, to) => {
    prisma.listing.findUnique.mockResolvedValue({ id, userId: ownerId, status: from });

    expect(await changeStatus(id, ownerId, to)).toEqual({
      error: 'INVALID_STATUS',
      from
    });
    expect(prisma.listing.updateMany).not.toHaveBeenCalled();
  });

  test('non-owner cannot change status', async () => {
    prisma.listing.findUnique.mockResolvedValue({ id, userId: ownerId, status: 'OPEN' });

    expect(await changeStatus(id, 'another-user', 'REQUESTED')).toEqual({
      error: 'FORBIDDEN'
    });
    expect(prisma.listing.updateMany).not.toHaveBeenCalled();
  });

  test('missing listing returns NOT_FOUND', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    expect(await changeStatus(id, ownerId, 'REQUESTED')).toEqual({
      error: 'NOT_FOUND'
    });
  });

  test('rejects when the status changed in the meantime', async () => {
    prisma.listing.findUnique.mockResolvedValue({ id, userId: ownerId, status: 'OPEN' });
    prisma.listing.updateMany.mockResolvedValue({ count: 0 });

    expect(await changeStatus(id, ownerId, 'REQUESTED')).toEqual({
      error: 'INVALID_STATUS',
      from: 'OPEN'
    });
  });
});
