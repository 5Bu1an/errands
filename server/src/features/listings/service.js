
const prisma = require('../../lib/prisma');

// US-09: Find a listing using its ID
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

module.exports = { getById };
