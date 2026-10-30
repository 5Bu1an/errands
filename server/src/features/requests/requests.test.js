// US-08: Request lifecycle rules.
jest.mock('../../lib/prisma', () => ({
  request: {
    findUnique: jest.fn(),
    updateMany: jest.fn()
  }
}));

const prisma = require('../../lib/prisma');
const { STATUSES, canTransition } = require('./lifecycle');
const { changeStatus } = require('./service');

const id = '550e8400-e29b-41d4-a716-446655440000';
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

const ALL_PAIRS = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to]));
const REJECTED = ALL_PAIRS.filter(([from, to]) => !isAllowed(from, to));

// The user allowed to set each status: the owner answers, the requester withdraws.
const actorFor = (status) => (status === 'CANCELLED' ? requesterId : ownerId);

function mockRequest(status, listingStatus = 'OPEN') {
  prisma.request.findUnique.mockResolvedValue({
    id,
    requesterId,
    status,
    listing: { userId: ownerId, status: listingStatus }
  });
}

beforeEach(() => {
  jest.clearAllMocks();
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
  test.each(ALLOWED)('saves a valid move %s -> %s', async (from, to) => {
    mockRequest(from);
    prisma.request.updateMany.mockResolvedValue({ count: 1 });

    expect(await changeStatus(id, actorFor(to), to)).toEqual({ success: true });
    expect(prisma.request.updateMany).toHaveBeenCalledWith({
      where: { id, status: from },
      data: { status: to }
    });
  });

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

    expect(await changeStatus(id, ownerId, 'PENDING')).toEqual({ error: 'FORBIDDEN' });
    expect(await changeStatus(id, requesterId, 'PENDING')).toEqual({ error: 'FORBIDDEN' });
    expect(prisma.request.updateMany).not.toHaveBeenCalled();
  });

  test('requester cannot accept their own request', async () => {
    mockRequest('PENDING');

    expect(await changeStatus(id, requesterId, 'ACCEPTED')).toEqual({
      error: 'FORBIDDEN'
    });
  });

  test('listing owner cannot cancel on behalf of the requester', async () => {
    mockRequest('PENDING');

    expect(await changeStatus(id, ownerId, 'CANCELLED')).toEqual({
      error: 'FORBIDDEN'
    });
  });

  test('missing request returns NOT_FOUND', async () => {
    prisma.request.findUnique.mockResolvedValue(null);

    expect(await changeStatus(id, ownerId, 'ACCEPTED')).toEqual({
      error: 'NOT_FOUND'
    });
  });

  test('rejects when the status changed in the meantime', async () => {
    mockRequest('PENDING');
    prisma.request.updateMany.mockResolvedValue({ count: 0 });

    expect(await changeStatus(id, ownerId, 'ACCEPTED')).toEqual({
      error: 'INVALID_STATUS',
      from: 'PENDING'
    });
  });
});
