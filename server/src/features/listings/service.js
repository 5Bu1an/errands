const prisma = require('../../lib/prisma');

// Saves a new listing for this user. New listings always start as OPEN.
// connectOrCreate makes sure the user has a row in "users" first, since
// signing up only creates the Supabase Auth account.
async function createListing(userId, data) {
  return prisma.listing.create({
    data: {
      ...data,
      status: 'OPEN',
      user: { connectOrCreate: { where: { id: userId }, create: { id: userId } } },
    },
  });
}

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

module.exports = { createListing, cancelListing };
