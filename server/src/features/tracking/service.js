
const prisma = require('../../lib/prisma');

const STEPS = [
  'LEAVING_NOW',
  'FIVE_MIN_AWAY',
  'IM_HERE',
  'COMPLETED',
];

const ACTIVE_STATUSES = ['CONFIRMED', 'IN_PROGRESS'];

async function getTracking(listingId, userId) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });

  if (!listing || listing.type !== 'RIDE') {
    return { error: 'NOT_FOUND' };
  }

  if (listing.userId !== userId) {
    const acceptedRequest = await prisma.request.findFirst({
      where: {
        listingId,
        requesterId: userId,
        status: 'ACCEPTED',
      },
    });

    if (!acceptedRequest) {
      return { error: 'FORBIDDEN' };
    }
  }

  const updates = await prisma.tripUpdate.findMany({
    where: { listingId },
    orderBy: [
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
  });

  return {
    updates,
    latestStep: updates.length
      ? updates[updates.length - 1].step
      : null,
  };
}

async function createTrackingUpdate(listingId, userId, step) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });

  if (!listing || listing.type !== 'RIDE') {
    return { error: 'NOT_FOUND' };
  }

  if (listing.userId !== userId) {
    return { error: 'FORBIDDEN' };
  }

  if (!ACTIVE_STATUSES.includes(listing.status)) {
    return { error: 'INVALID_STATUS' };
  }

  if (!STEPS.includes(step)) {
    return { error: 'INVALID_STEP' };
  }

  const latest = await prisma.tripUpdate.findFirst({
    where: { listingId },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
  });

  const expectedIndex = latest
    ? STEPS.indexOf(latest.step) + 1
    : 0;

  if (expectedIndex >= STEPS.length ||
      STEPS[expectedIndex] !== step) {
    return {
      error: 'INVALID_SEQUENCE',
      expectedStep: STEPS[expectedIndex] || null,
    };
  }

  const update = await prisma.tripUpdate.create({
    data: { listingId, step },
  });

  return { update };
}

module.exports = {
  STEPS,
  getTracking,
  createTrackingUpdate,
};
