
const prisma = require('../../lib/prisma');
const { canTransition } = require('./lifecycle');
const listingLifecycle = require('../listings/lifecycle');

const OWNER_STATUSES = ['ACCEPTED', 'DECLINED'];
const REQUESTER_STATUSES = ['CANCELLED'];
const ACCEPTING_LISTING_STATUSES = ['OPEN', 'REQUESTED', 'CONFIRMED'];

function capacityOf(listing) {
  return listing.type === 'RIDE' ? listing.availableSeats || 0 : 1;
}

// Lock the listing row so concurrent requests and acceptances
// cannot make conflicting capacity decisions.
async function lockListing(tx, listingId) {
  const rows = await tx.$queryRaw`
    SELECT id FROM listings
    WHERE id = ${listingId}::uuid
    FOR UPDATE
  `;
  return rows.length > 0;
}

// US-08 / US-07: Change a request's status.
async function changeStatus(id, userId, status) {
  return prisma.$transaction(async (tx) => {
    const initial = await tx.request.findUnique({
      where: { id },
      select: { listingId: true }
    });

    if (!initial) {
      return { error: 'NOT_FOUND' };
    }

    if (!(await lockListing(tx, initial.listingId))) {
      return { error: 'NOT_FOUND' };
    }

    const request = await tx.request.findUnique({
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

    const transitions = listingLifecycle.TRANSITIONS[request.listing.status] || [];
    const listingFinished = transitions.length === 0;

    if (listingFinished || !canTransition(request.status, status)) {
      return { error: 'INVALID_STATUS', from: request.status };
    }

    let acceptedCount = 0;

    if (status === 'ACCEPTED') {
      if (!ACCEPTING_LISTING_STATUSES.includes(request.listing.status)) {
        return { error: 'INVALID_STATUS', from: request.status };
      }

      acceptedCount = await tx.request.count({
        where: { listingId: request.listingId, status: 'ACCEPTED' }
      });

      if (acceptedCount >= capacityOf(request.listing)) {
        return { error: 'LISTING_FULL' };
      }
    }

    const result = await tx.request.updateMany({
      where: { id, status: request.status },
      data: { status }
    });

    if (result.count === 0) {
      return { error: 'INVALID_STATUS', from: request.status };
    }

    if (status === 'ACCEPTED') {
      await tx.listing.updateMany({
        where: {
          id: request.listingId,
          status: { in: ['OPEN', 'REQUESTED'] }
        },
        data: { status: 'CONFIRMED' }
      });

      if (acceptedCount + 1 >= capacityOf(request.listing)) {
        const others = await tx.request.findMany({
          where: {
            listingId: request.listingId,
            status: 'PENDING'
          },
          select: { id: true, requesterId: true }
        });

        if (others.length > 0) {
          await tx.request.updateMany({
            where: {
              id: { in: others.map((r) => r.id) },
              status: 'PENDING'
            },
            data: { status: 'DECLINED' }
          });

          for (const other of others) {
            await tx.notification.create({
              data: {
                userId: other.requesterId,
                message: `"${request.listing.title}" is now full, so your request was declined.`
              }
            });
          }
        }
      }

      await tx.notification.create({
        data: {
          userId: request.requesterId,
          message: `Your request for "${request.listing.title}" has been accepted!`
        }
      });
    } else if (status === 'DECLINED') {
      await tx.notification.create({
        data: {
          userId: request.requesterId,
          message: `Your request for "${request.listing.title}" was declined.`
        }
      });
    }

    return { success: true };
  });
}

// US-07: Listing owners can view incoming requests.
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
    include: {
      requester: { select: { id: true, name: true } }
    }
  });

  return { requests };
}

// US-06: Create a ride-seat or task-help request.
async function createRequest(userId, listingId, pickupLocation, note) {
  return prisma.$transaction(async (tx) => {
    if (!(await lockListing(tx, listingId))) {
      return { error: 'NOT_FOUND' };
    }

    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        userId: true,
        title: true,
        type: true,
        status: true,
        availableSeats: true
      }
    });

    if (!listing) {
      return { error: 'NOT_FOUND' };
    }

    if (listing.userId === userId) {
      return { error: 'OWN_LISTING' };
    }

    if (!ACCEPTING_LISTING_STATUSES.includes(listing.status)) {
      return { error: 'NOT_OPEN' };
    }

    const existing = await tx.request.findFirst({
      where: {
        listingId,
        requesterId: userId,
        status: { in: ['PENDING', 'ACCEPTED'] }
      },
      select: { id: true }
    });

    if (existing) {
      return { error: 'ALREADY_REQUESTED' };
    }

    const acceptedCount = await tx.request.count({
      where: { listingId, status: 'ACCEPTED' }
    });

    if (acceptedCount >= capacityOf(listing)) {
      return { error: 'LISTING_FULL' };
    }

    const request = await tx.request.create({
      data: {
        pickupLocation,
        note,
        listing: { connect: { id: listingId } },
        requester: {
          connectOrCreate: {
            where: { id: userId },
            create: { id: userId }
          }
        }
      }
    });

    await tx.listing.updateMany({
      where: { id: listingId, status: 'OPEN' },
      data: { status: 'REQUESTED' }
    });

    await tx.notification.create({
      data: {
        userId: listing.userId,
        message: `You have a new request for your listing "${listing.title}".`
      }
    });

    return { request };
  });
}

// US-18: View requests made by the current user.
async function getMyRequests(userId) {
  return prisma.request.findMany({
    where: { requesterId: userId },
    orderBy: { createdAt: 'desc' },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          type: true,
          time: true,
          status: true,
          price: true
        }
      }
    }
  });
}

module.exports = {
  changeStatus,
  getListingRequests,
  createRequest,
  getMyRequests
};
