const prisma = require('../../lib/prisma');

// Find the request and check whether this user belongs to its chat.
async function getChatRequest(requestId, userId) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      listing: {
        select: { userId: true }
      }
    }
  });

  if (!request) {
    return { error: 'NOT_FOUND' };
  }

  const isRequester = request.requesterId === userId;
  const isOwner = request.listing.userId === userId;

  if (!isRequester && !isOwner) {
    return { error: 'FORBIDDEN' };
  }

  return { request };
}

// Get the latest 100 messages, displayed oldest first.
async function getMessages(requestId, userId) {
  const result = await getChatRequest(requestId, userId);

  if (result.error) {
    return result;
  }

  const messages = await prisma.message.findMany({
    where: { requestId },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }
    ],
    take: 100,
    include: {
      sender: {
        select: { id: true, name: true }
      }
    }
  });

  return { messages: messages.reverse() };
}

// Send a message to the other participant.
async function sendMessage(requestId, userId, body) {
  if (typeof body !== 'string' || !body.trim()) {
    return { error: 'EMPTY_MESSAGE' };
  }

  const text = body.trim();

  if (text.length > 2000) {
    return { error: 'MESSAGE_TOO_LONG' };
  }

  const result = await getChatRequest(requestId, userId);

  if (result.error) {
    return result;
  }

  const request = result.request;

  const receiverId =
    userId === request.requesterId
      ? request.listing.userId
      : request.requesterId;

  const message = await prisma.message.create({
    data: {
      requestId: request.id,
      listingId: request.listingId,
      senderId: userId,
      receiverId,
      body: text
    },
    include: {
      sender: {
        select: { id: true, name: true }
      }
    }
  });

  return { message };
}

module.exports = { getMessages, sendMessage };