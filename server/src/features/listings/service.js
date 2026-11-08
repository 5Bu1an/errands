const prisma = require('../../lib/prisma');
const { canTransition } = require('./lifecycle');

// Create a new listing for a user.
// New listings always start with OPEN status.
async function createListing(userId, data) {
  return prisma.listing.create({
    data: {
      ...data,
      status: 'OPEN',
      user: {
        connectOrCreate: {
          where: { id: userId },
          create: { id: userId }
        }
      }
    }
  });
}

// US-13: Turn the browse filters into a Prisma "where". Listings must be OPEN
// and match every filter that was given.
function buildListingWhere(filters = {}) {
  const where = { status: 'OPEN' };

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.from || filters.to) {
    where.time = {};
    if (filters.from) where.time.gte = filters.from;
    if (filters.to) where.time.lte = filters.to;
  }

  if (filters.maxPrice != null) {
    where.price = { lte: filters.maxPrice };
  }

  // Location matches the pickup, destination or title, ignoring upper/lower case.
  if (filters.location) {
    const match = { contains: filters.location, mode: 'insensitive' };
    where.OR = [
      { pickupLocation: match },
      { dropoffText: match },
      { title: match }
    ];
  }

  return where;
}

// All OPEN listings that match the filters, soonest first, with the poster's name for the card.
async function listOpenListings(filters = {}) {
  return prisma.listing.findMany({
    where: buildListingWhere(filters),
    orderBy: { time: 'asc' },
    include: { user: { select: { id: true, name: true } } },
  });
}

// US-09: Find a listing using its ID.
async function getById(id) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return listing;
}

// US-08: Move a listing to a new status, following the lifecycle rules.
async function changeStatus(id, userId, status) {
  const listing = await prisma.listing.findUnique({
    where: { id }
  });

  if (!listing) {
    return { error: 'NOT_FOUND' };
  }

  if (listing.userId !== userId) {
    return { error: 'FORBIDDEN' };
  }

  if (!canTransition(listing.status, status)) {
    return { error: 'INVALID_STATUS', from: listing.status };
  }

  // US-17: Notify accepted requesters when the listing is completed
  if (status === 'COMPLETED') {
    const acceptedRequests = await prisma.request.findMany({
      where: { listingId: id, status: 'ACCEPTED' }
    });

    for (const req of acceptedRequests) {
      await prisma.notification.create({
        data: {
          userId: req.requesterId,
          message: `The listing "${listing.title}" has been completed. Please rate your experience!`
        }
      });
    }
  }

  // Only update if the status is still the one we checked,
  // so a concurrent change can't slip past the rules.
  const result = await prisma.listing.updateMany({
    where: { id, userId, status: listing.status },
    data: { status }
  });

  if (result.count === 0) {
    return { error: 'INVALID_STATUS', from: listing.status };
  }



  return { success: true };
}

// US-14: Cancel a listing.
async function cancelListing(id, userId) {
  return changeStatus(id, userId, 'CANCELLED');
}

module.exports = { createListing, buildListingWhere, listOpenListings, getById, changeStatus, cancelListing };
