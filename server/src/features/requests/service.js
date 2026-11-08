const prisma = require('../../lib/prisma');
const { canTransition } = require('./lifecycle');
const listingLifecycle = require('../listings/lifecycle');

const OWNER_STATUSES = ['ACCEPTED', 'DECLINED'];
const REQUESTER_STATUSES = ['CANCELLED'];

// US-07: a request can only be accepted while the listing hasn't started yet.
const ACCEPTING_LISTING_STATUSES = ['OPEN', 'REQUESTED', 'CONFIRMED'];

// US-07: a ride holds as many riders as it has seats, a task has one helper.
function capacityOf(listing) {
  return listing.type === 'RIDE' ? listing.availableSeats || 0 : 1;
}

async function changeStatus(id, userId, status) {
  // Include listing details and listing owner info to know who to notify
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      listing: {
        select: {
          userId: true,
          status: true,
          title: true,
          type: true,
          availableSeats: true
        }
      }
    }
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

  const listingFinished =
    listingLifecycle.TRANSITIONS[request.listing.status].length === 0;
  if (listingFinished || !canTransition(request.status, status)) {
    return { error: 'INVALID_STATUS', from: request.status };
  }

  // US-07: check the listing can still take this person before accepting.
  let acceptedCount = 0;
  if (status === 'ACCEPTED') {
    if (!ACCEPTING_LISTING_STATUSES.includes(request.listing.status)) {
      return { error: 'INVALID_STATUS', from: request.status };
    }

    acceptedCount = await prisma.request.count({
      where: { listingId: request.listingId, status: 'ACCEPTED' }
    });

    if (acceptedCount >= capacityOf(request.listing)) {
      return { error: 'LISTING_FULL' };
    }
  }

  const result = await prisma.request.updateMany({
    where: { id, status: request.status },
    data: { status }
  });

  if (result.count === 0) {
    return { error: 'INVALID_STATUS', from: request.status };
  }

  if (status === 'ACCEPTED') {
    await afterAccept(request, acceptedCount + 1);
  }

  // US-17: Send notification to the requester when accepted or declined
  if (status === 'ACCEPTED') {
    await prisma.notification.create({
      data: {
        userId: request.requesterId,
        message: `Your request for "${request.listing.title}" has been accepted!`
      }
    });
  } else if (status === 'DECLINED') {
    await prisma.notification.create({
      data: {
        userId: request.requesterId,
        message: `Your request for "${request.listing.title}" was declined.`
      }
    });
  }

  return { success: true };
}

// US-07: once someone is accepted the listing becomes CONFIRMED. When every
// seat (or the one task spot) is taken, the other pending requests are declined.
async function afterAccept(request, acceptedNow) {
  // A pending request means the listing is REQUESTED, so this is the
  // REQUESTED -> CONFIRMED step. Already-CONFIRMED listings are left alone.
  await prisma.listing.updateMany({
    where: { id: request.listingId, status: { in: ['OPEN', 'REQUESTED'] } },
    data: { status: 'CONFIRMED' }
  });

  if (acceptedNow < capacityOf(request.listing)) {
    return;
  }

  const others = await prisma.request.findMany({
    where: { listingId: request.listingId, status: 'PENDING' },
    select: { id: true, requesterId: true }
  });

  if (others.length === 0) {
    return;
  }

  await prisma.request.updateMany({
    where: { id: { in: others.map((r) => r.id) }, status: 'PENDING' },
    data: { status: 'DECLINED' }
  });

  for (const other of others) {
    await prisma.notification.create({
      data: {
        userId: other.requesterId,
        message: `"${request.listing.title}" is now full, so your request was declined.`
      }
    });
  }
}

// US-07: the listing owner sees every request on their listing, oldest first.
async function getListingRequests(listingId, userId) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { userId: true }
  });

  if (!listing) {
    return { error: 'NOT_FOUND' };
  }

  if (listing.userId !== userId) {
    return { error: 'FORBIDDEN' };
  }

  const requests = await prisma.request.findMany({
    where: { listingId },
    orderBy: { createdAt: 'asc' },
    include: { requester: { select: { id: true, name: true } } }
  });

  return { requests };
}

// US-17: Create a new request and notify the listing owner
async function createRequest(userId, listingId, pickupLocation, note) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId }
  });

  if (!listing) {
    return { error: 'NOT_FOUND' };
  }

  const newRequest = await prisma.request.create({
    data: {
      listingId,
      requesterId: userId,
      pickupLocation,
      note
    }
  });

  // Notify the listing owner
  await prisma.notification.create({
    data: {
      userId: listing.userId,
      message: `You have a new request for your listing "${listing.title}".`
    }
  });

  return newRequest;
}

module.exports = { changeStatus, getListingRequests, createRequest };
