const prisma = require('../../lib/prisma');

// US-16: My latest notifications, newest first.
async function listForUser(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
}

module.exports = { listForUser };
