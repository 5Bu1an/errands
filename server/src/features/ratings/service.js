const prisma = require('../../lib/prisma');

// US15: Rate the other participant after a completed ride/task.
async function createRating(giverId, data) {
  const { listingId, receiverId, score, comment } = data;

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return { error: 'INVALID_SCORE' };
  }

  if (
    comment != null &&
    (typeof comment !== 'string' || comment.trim().length > 1000)
  ) {
    return { error: 'INVALID_COMMENT' };
  }

  if (giverId === receiverId) {
    return { error: 'SELF_RATING' };
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      requests: {
        where: { status: 'ACCEPTED' },
        select: { requesterId: true }
      }
    }
  });

  if (!listing) {
    return { error: 'NOT_FOUND' };
  }

  // Only the owner and an accepted requester can rate each other.
  const acceptedIds = listing.requests.map(
    (request) => request.requesterId
  );

  const ownerRatesRequester =
    giverId === listing.userId &&
    acceptedIds.includes(receiverId);

  const requesterRatesOwner =
    receiverId === listing.userId &&
    acceptedIds.includes(giverId);

  if (!ownerRatesRequester && !requesterRatesOwner) {
    return { error: 'FORBIDDEN' };
  }

  if (listing.status !== 'COMPLETED') {
    return { error: 'NOT_COMPLETED' };
  }

  const existing = await prisma.rating.findFirst({
    where: { listingId, giverId, receiverId }
  });

  if (existing) {
    return { error: 'ALREADY_RATED' };
  }

  try {
    const rating = await prisma.rating.create({
      data: {
        listingId,
        giverId,
        receiverId,
        score,
        comment: comment == null ? null : comment.trim() || null
      }
    });

    return { rating };
  } catch (error) {
    // The database constraint also blocks simultaneous duplicates.
    if (error.code === 'P2002') {
      return { error: 'ALREADY_RATED' };
    }

    throw error;
  }
}

// Used to display a user's average score and number of ratings.
async function getRatingSummary(userId) {
  const result = await prisma.rating.aggregate({
    where: { receiverId: userId },
    _avg: { score: true },
    _count: { _all: true }
  });

  return {
    averageRating: result._avg.score,
    ratingCount: result._count._all
  };

}
async function getRatingOptions(listingId, userId) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      user: { select: { id: true, name: true } },
      requests: {
        where: { status: 'ACCEPTED' },
        include: {
          requester: { select: { id: true, name: true } }
        }
      },
      ratings: { where: { giverId: userId } }
    }
  });

  if (!listing) return { error: 'NOT_FOUND' };

  const isOwner = listing.userId === userId;
  const participated = listing.requests.some(
    (request) => request.requesterId === userId
  );

  if (!isOwner && !participated) return { error: 'FORBIDDEN' };

  if (listing.status !== 'COMPLETED') {
    return { error: 'NOT_COMPLETED' };
  }

  const people = isOwner
    ? listing.requests.map((request) => request.requester)
    : [listing.user];

  const uniquePeople = [
    ...new Map(people.map((person) => [person.id, person])).values()
  ];

  return {
    people: uniquePeople.map((person) => ({
      ...person,
      alreadyRated: listing.ratings.some(
        (rating) => rating.receiverId === person.id
      )
    }))
  };
}



module.exports = {
  createRating,
  getRatingSummary,
  getRatingOptions
};