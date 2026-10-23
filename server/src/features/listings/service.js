
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

module.exports = { createListing, getById };
