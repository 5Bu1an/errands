const { PrismaClient } = require('@prisma/client');

// One shared client for the whole app. Each PrismaClient opens its own pool of
// database connections, so creating one per request would run out of connections fast.
const prisma = new PrismaClient();

module.exports = prisma;