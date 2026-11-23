const prisma = require('../../lib/prisma');

// US-20: File a report against a listing, a user, or both.
// Returns { report } or { error } with one of:
// SELF_REPORT, OWN_LISTING, LISTING_NOT_FOUND, USER_NOT_FOUND, DUPLICATE
async function createReport(reporterId, { listingId = null, reportedId = null, reason }) {
  if (reportedId && reportedId === reporterId) return { error: 'SELF_REPORT' };

  if (listingId) {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { userId: true }
    });
    if (!listing) return { error: 'LISTING_NOT_FOUND' };
    if (listing.userId === reporterId) return { error: 'OWN_LISTING' };
  }

  if (reportedId) {
    const user = await prisma.user.findUnique({ where: { id: reportedId }, select: { id: true } });
    if (!user) return { error: 'USER_NOT_FOUND' };
  }

  // One open report per person per target, so the same thing can't be spammed.
  const existing = await prisma.report.findFirst({
    where: { reporterId, listingId, reportedId, status: { not: 'RESOLVED' } },
    select: { id: true }
  });
  if (existing) return { error: 'DUPLICATE' };

  // Profiles are created lazily, so make sure the reporter has a users row.
  await prisma.user.upsert({ where: { id: reporterId }, update: {}, create: { id: reporterId } });

  const report = await prisma.report.create({
    data: { reporterId, listingId, reportedId, reason }
  });

  return { report };
}

module.exports = { createReport };
