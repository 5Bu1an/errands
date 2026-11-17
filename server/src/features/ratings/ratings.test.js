jest.mock('../../lib/prisma', () => ({
  listing: { findUnique: jest.fn() },
  rating: {
    findFirst: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn()
  }
}));

const prisma = require('../../lib/prisma');
const { createRating, getRatingSummary } = require('./service');

const input = {
  listingId: 'listing-1',
  receiverId: 'owner-1',
  score: 4,
  comment: 'Good experience'
};

beforeEach(() => {
  jest.resetAllMocks();

  prisma.listing.findUnique.mockResolvedValue({
    id: 'listing-1',
    userId: 'owner-1',
    status: 'COMPLETED',
    requests: [{ requesterId: 'rider-1' }]
  });

  prisma.rating.findFirst.mockResolvedValue(null);
  prisma.rating.create.mockImplementation(async ({ data }) => ({
    id: 'rating-1',
    ...data
  }));
});

test('accepted rider can rate the owner after completion', async () => {
  const result = await createRating('rider-1', input);

  expect(result.rating).toMatchObject({
    giverId: 'rider-1',
    receiverId: 'owner-1',
    score: 4
  });
});

test('owner can rate an accepted rider', async () => {
  const result = await createRating('owner-1', {
    ...input,
    receiverId: 'rider-1'
  });

  expect(result.rating.receiverId).toBe('rider-1');
});

test('rejects ratings before completion', async () => {
  prisma.listing.findUnique.mockResolvedValue({
    userId: 'owner-1',
    status: 'IN_PROGRESS',
    requests: [{ requesterId: 'rider-1' }]
  });

  expect(await createRating('rider-1', input)).toEqual({
    error: 'NOT_COMPLETED'
  });
  expect(prisma.rating.create).not.toHaveBeenCalled();
});

test('rejects someone who did not participate', async () => {
  expect(await createRating('stranger-1', input)).toEqual({
    error: 'FORBIDDEN'
  });
  expect(prisma.rating.create).not.toHaveBeenCalled();
});

test('rejects self-rating', async () => {
  expect(await createRating('owner-1', input)).toEqual({
    error: 'SELF_RATING'
  });
});

test.each([0, 6, 2.5, '4', null])(
  'rejects invalid score %p',
  async (score) => {
    expect(
      await createRating('rider-1', { ...input, score })
    ).toEqual({ error: 'INVALID_SCORE' });

    expect(prisma.rating.create).not.toHaveBeenCalled();
  }
);

test('rejects duplicate ratings', async () => {
  prisma.rating.findFirst.mockResolvedValue({ id: 'existing-rating' });

  expect(await createRating('rider-1', input)).toEqual({
    error: 'ALREADY_RATED'
  });
  expect(prisma.rating.create).not.toHaveBeenCalled();
});

test('handles a duplicate detected by the database', async () => {
  prisma.rating.create.mockRejectedValue({ code: 'P2002' });

  expect(await createRating('rider-1', input)).toEqual({
    error: 'ALREADY_RATED'
  });
});

test('returns the average rating and count', async () => {
  prisma.rating.aggregate.mockResolvedValue({
    _avg: { score: 4.5 },
    _count: { _all: 2 }
  });

  expect(await getRatingSummary('owner-1')).toEqual({
    averageRating: 4.5,
    ratingCount: 2
  });
});

test('returns null average when there are no ratings', async () => {
  prisma.rating.aggregate.mockResolvedValue({
    _avg: { score: null },
    _count: { _all: 0 }
  });

  expect(await getRatingSummary('owner-1')).toEqual({
    averageRating: null,
    ratingCount: 0
  });
});