
jest.mock('../../lib/prisma', () => ({
  listing: {
    findUnique: jest.fn(),
  },
  request: {
    findFirst: jest.fn(),
  },
  tripUpdate: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
}));

const prisma = require('../../lib/prisma');
const service = require('./service');

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const RIDER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';
const LISTING_ID = '44444444-4444-4444-8444-444444444444';

const ride = {
  id: LISTING_ID,
  userId: OWNER_ID,
  type: 'RIDE',
  status: 'IN_PROGRESS',
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.listing.findUnique.mockResolvedValue({ ...ride });
  prisma.request.findFirst.mockResolvedValue(null);
  prisma.tripUpdate.findMany.mockResolvedValue([]);
  prisma.tripUpdate.findFirst.mockResolvedValue(null);
});

describe('US-11: View trip progress', () => {
  test('owner can view trip progress', async () => {
    const result = await service.getTracking(LISTING_ID, OWNER_ID);

    expect(result).toEqual({
      updates: [],
      latestStep: null,
    });
  });

  test('accepted rider can view trip progress', async () => {
    prisma.request.findFirst.mockResolvedValue({
      status: 'ACCEPTED',
      requesterId: RIDER_ID,
    });

    const result = await service.getTracking(LISTING_ID, RIDER_ID);

    expect(result.error).toBeUndefined();
    expect(prisma.request.findFirst).toHaveBeenCalledWith({
      where: {
        listingId: LISTING_ID,
        requesterId: RIDER_ID,
        status: 'ACCEPTED',
      },
    });
  });

  test('unrelated user cannot view trip progress', async () => {
    const result = await service.getTracking(LISTING_ID, OTHER_ID);

    expect(result).toEqual({ error: 'FORBIDDEN' });
  });

  test('missing listing returns NOT_FOUND', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    const result = await service.getTracking(LISTING_ID, OWNER_ID);

    expect(result).toEqual({ error: 'NOT_FOUND' });
  });

  test('task listings cannot use ride tracking', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      ...ride,
      type: 'TASK',
    });

    const result = await service.getTracking(LISTING_ID, OWNER_ID);

    expect(result).toEqual({ error: 'NOT_FOUND' });
  });

  test('returns latest step from update history', async () => {
    prisma.tripUpdate.findMany.mockResolvedValue([
      { step: 'LEAVING_NOW' },
      { step: 'FIVE_MIN_AWAY' },
    ]);

    const result = await service.getTracking(LISTING_ID, OWNER_ID);

    expect(result.latestStep).toBe('FIVE_MIN_AWAY');
    expect(result.updates).toHaveLength(2);
  });
});

describe('US-11: Post trip progress updates', () => {
  test('owner can post the first tracking step', async () => {
    const update = {
      id: '55555555-5555-4555-8555-555555555555',
      listingId: LISTING_ID,
      step: 'LEAVING_NOW',
    };

    prisma.tripUpdate.create.mockResolvedValue(update);

    const result = await service.createTrackingUpdate(
      LISTING_ID,
      OWNER_ID,
      'LEAVING_NOW'
    );

    expect(result).toEqual({ update });
    expect(prisma.tripUpdate.create).toHaveBeenCalledWith({
      data: {
        listingId: LISTING_ID,
        step: 'LEAVING_NOW',
      },
    });
  });

  test('rider cannot post tracking updates', async () => {
    const result = await service.createTrackingUpdate(
      LISTING_ID,
      RIDER_ID,
      'LEAVING_NOW'
    );

    expect(result).toEqual({ error: 'FORBIDDEN' });
    expect(prisma.tripUpdate.create).not.toHaveBeenCalled();
  });

  test('missing listing cannot receive updates', async () => {
    prisma.listing.findUnique.mockResolvedValue(null);

    const result = await service.createTrackingUpdate(
      LISTING_ID,
      OWNER_ID,
      'LEAVING_NOW'
    );

    expect(result).toEqual({ error: 'NOT_FOUND' });
  });

  test('cancelled rides cannot receive updates', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      ...ride,
      status: 'CANCELLED',
    });

    const result = await service.createTrackingUpdate(
      LISTING_ID,
      OWNER_ID,
      'LEAVING_NOW'
    );

    expect(result).toEqual({ error: 'INVALID_STATUS' });
  });

  test('open rides cannot start tracking', async () => {
    prisma.listing.findUnique.mockResolvedValue({
      ...ride,
      status: 'OPEN',
    });

    const result = await service.createTrackingUpdate(
      LISTING_ID,
      OWNER_ID,
      'LEAVING_NOW'
    );

    expect(result).toEqual({ error: 'INVALID_STATUS' });
  });

  test('tracking steps cannot be skipped', async () => {
    const result = await service.createTrackingUpdate(
      LISTING_ID,
      OWNER_ID,
      'IM_HERE'
    );

    expect(result).toEqual({
      error: 'INVALID_SEQUENCE',
      expectedStep: 'LEAVING_NOW',
    });
  });

  test('allows the next sequential tracking step', async () => {
    prisma.tripUpdate.findFirst.mockResolvedValue({
      step: 'LEAVING_NOW',
    });

    prisma.tripUpdate.create.mockResolvedValue({
      step: 'FIVE_MIN_AWAY',
    });

    const result = await service.createTrackingUpdate(
      LISTING_ID,
      OWNER_ID,
      'FIVE_MIN_AWAY'
    );

    expect(result.update.step).toBe('FIVE_MIN_AWAY');
  });

  test('duplicate tracking steps are rejected', async () => {
    prisma.tripUpdate.findFirst.mockResolvedValue({
      step: 'LEAVING_NOW',
    });

    const result = await service.createTrackingUpdate(
      LISTING_ID,
      OWNER_ID,
      'LEAVING_NOW'
    );

    expect(result).toEqual({
      error: 'INVALID_SEQUENCE',
      expectedStep: 'FIVE_MIN_AWAY',
    });
  });

  test('cannot post updates after COMPLETED', async () => {
    prisma.tripUpdate.findFirst.mockResolvedValue({
      step: 'COMPLETED',
    });

    const result = await service.createTrackingUpdate(
      LISTING_ID,
      OWNER_ID,
      'COMPLETED'
    );

    expect(result).toEqual({
      error: 'INVALID_SEQUENCE',
      expectedStep: null,
    });
  });

  test('invalid tracking step is rejected', async () => {
    const result = await service.createTrackingUpdate(
      LISTING_ID,
      OWNER_ID,
      'FLYING'
    );

    expect(result).toEqual({ error: 'INVALID_STEP' });
  });
});
