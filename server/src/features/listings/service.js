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

module.exports = { createListing, getById, changeStatus, cancelListing };