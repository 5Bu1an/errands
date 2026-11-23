const prisma = require('../../lib/prisma');
const supabase = require('../../lib/supabase');
const { createNotification } = require('../notifications/service');

const OPEN_REPORTS = { where: { status: { not: 'RESOLVED' } } };
const NAME = { select: { id: true, name: true } };

// Emails live in Supabase Auth, not our users table. Best effort: if the
// lookup fails the admin page still works, just without emails.
async function emailsById() {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return {};
    return Object.fromEntries((data?.users || []).map((u) => [u.id, u.email]));
  } catch {
    return {};
  }
}

// US-19: Every user, newest first, with how much they've posted and how
// many open reports are against them.
async function listUsers() {
  const [users, emails] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        program: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { listings: true, reportsAgainst: OPEN_REPORTS } }
      }
    }),
    emailsById()
  ]);

  return users.map((user) => ({ ...user, email: emails[user.id] || null }));
}

// US-19: Every listing in any status, newest first.
async function listListings() {
  return prisma.listing.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: NAME, _count: { select: { reports: OPEN_REPORTS } } }
  });
}

// US-19: Reports for the admin to review, newest first. Optional status filter.
async function listReports(status) {
  return prisma.report.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      reporter: NAME,
      reported: NAME,
      listing: { select: { id: true, title: true, status: true, userId: true } }
    }
  });
}

// US-19: Mark a report REVIEWED or RESOLVED.
async function updateReportStatus(id, status) {
  const result = await prisma.report.updateMany({ where: { id }, data: { status } });
  if (result.count === 0) return { error: 'NOT_FOUND' };
  return { success: true };
}

// US-19: Remove a listing. Its requests, chat and reports go with it.
// The owner is told it was removed.
async function removeListing(id) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { userId: true, title: true }
  });
  if (!listing) return { error: 'NOT_FOUND' };

  await prisma.listing.delete({ where: { id } });

  await createNotification({
    userId: listing.userId,
    title: 'Listing removed',
    message: `Your listing "${listing.title}" was removed by an admin for breaking the community rules.`
  });

  return { success: true };
}

// US-19: Remove a user: their login and everything they posted.
// Admins can't remove themselves or another admin.
async function removeUser(id, adminId) {
  if (id === adminId) return { error: 'SELF' };

  const user = await prisma.user.findUnique({ where: { id }, select: { isAdmin: true } });
  if (!user) return { error: 'NOT_FOUND' };
  if (user.isAdmin) return { error: 'ADMIN' };

  // Delete the login first so they can't sign back in and recreate a profile.
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error && error.status !== 404) throw error;

  await prisma.user.deleteMany({ where: { id } });
  return { success: true };
}

module.exports = {
  listUsers,
  listListings,
  listReports,
  updateReportStatus,
  removeListing,
  removeUser
};
