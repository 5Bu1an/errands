
const prisma = require('../../lib/prisma');
const { canTransition } = require('./lifecycle');
const listingLifecycle = require('../listings/lifecycle');

const OWNER_STATUSES = ['ACCEPTED', 'DECLINED'];
const REQUESTER_STATUSES = ['CANCELLED'];

async function changeStatus(id, userId, status) {
  // Include listing details and owner information for notifications.
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      listing: {
        select: {
          userId: true,
          status: true,
          title: true
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

  const result = await prisma.request.updateMany({
    where: { id, status: request.status },
    data: { status }
  });

  if (result.count === 0) {
    return { error: 'INVALID_STATUS', from: request.status };
  }

  // US-17: Notify the requester when accepted or declined.
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
        message: `Your request for "${request.listing.title}" has been declined.`
      }
    });
  }

  return { success: true };
}

// US-06: Request a ride seat with a typed pickup point.
async function createRequest(userId, listingId, pickupLocation, note) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId }
  });

  if (!listing) {
    return { error: 'NOT_FOUND' };
  }

  // Users cannot request seats on their own listings.
  if (listing.userId === userId) {
    return { error: 'FORBIDDEN' };
  }

  // Only open rides with available seats can receive requests.
  if (
    listing.type !== 'RIDE' ||
    listing.status !== 'OPEN' ||
    !Number.isInteger(listing.availableSeats) ||
    listing.availableSeats <= 0
  ) {
    return { error: 'UNAVAILABLE' };
  }

  // Prevent duplicate active requests from the same rider.
  const existingRequest = await prisma.request.findFirst({
    where: {
      listingId,
      requesterId: userId,
      status: {
        in: ['PENDING', 'ACCEPTED']
      }
    }
  });

  if (existingRequest) {
    return { error: 'DUPLICATE' };
  }

  // Create the request with a pending status.
  const newRequest = await prisma.request.create({
    data: {
      listingId,
      requesterId: userId,
      pickupLocation,
      note,
      status: 'PENDING'
    }
  });

  // US-17: Notify the listing owner about the new request.
  await prisma.notification.create({
    data: {
      userId: listing.userId,
      message: `You have a new request for your listing "${listing.title}".`
    }
  });

  return newRequest;
}

module.exports = { changeStatus, createRequest };