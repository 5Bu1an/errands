const prisma = require('../../lib/prisma');

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

// US-14: Cancel a listing.
async function cancelListing(id, userId) {
  const listing = await prisma.listing.findUnique({
    where: { id }
  });

  if (!listing) {
    return { error: 'NOT_FOUND' };
  }

  if (listing.userId !== userId) {
    return { error: 'FORBIDDEN' };
  }

  if (['COMPLETED', 'CANCELLED'].includes(listing.status)) {
    return { error: 'INVALID_STATUS' };
  }

  const result = await prisma.listing.updateMany({
    where: {
      id,
      userId,
      status: { notIn: ['COMPLETED', 'CANCELLED'] }
    },
    data: { status: 'CANCELLED' }
  });

  if (result.count === 0) {
    return { error: 'INVALID_STATUS' };
  }

  return { success: true };
}

module.exports = { createListing, getById, cancelListing };