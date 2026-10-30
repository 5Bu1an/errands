const prisma = require('../../lib/prisma');
const { canTransition } = require('./lifecycle');
const listingLifecycle = require('../listings/lifecycle');

// Who may set each status: the listing owner answers a request,
// the requester can withdraw it.
const OWNER_STATUSES = ['ACCEPTED', 'DECLINED'];
const REQUESTER_STATUSES = ['CANCELLED'];

// US-08: Move a request to a new status, following the lifecycle rules.
async function changeStatus(id, userId, status) {
  const request = await prisma.request.findUnique({
    where: { id },
    include: { listing: { select: { userId: true, status: true } } }
  });

  if (!request) {
    return { error: 'NOT_FOUND' };
  }

  const isOwner = request.listing.userId === userId;
  const isRequester = request.requesterId === userId;
  if (
    !(isOwner && OWNER_STATUSES.includes(status)) &&
    !(isRequester && REQUESTER_STATUSES.includes(status))
  ) {
    return { error: 'FORBIDDEN' };
  }

  // A finished listing (Completed or Cancelled) freezes its requests too.
  const listingFinished =
    listingLifecycle.TRANSITIONS[request.listing.status].length === 0;
  if (listingFinished || !canTransition(request.status, status)) {
    return { error: 'INVALID_STATUS', from: request.status };
  }

  // Only update if the status is still the one we checked,
  // so a concurrent change can't slip past the rules.
  const result = await prisma.request.updateMany({
    where: { id, status: request.status },
    data: { status }
  });

  if (result.count === 0) {
    return { error: 'INVALID_STATUS', from: request.status };
  }

  return { success: true };
}

module.exports = { changeStatus };
