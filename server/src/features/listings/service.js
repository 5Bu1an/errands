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

module.exports = { createListing };
