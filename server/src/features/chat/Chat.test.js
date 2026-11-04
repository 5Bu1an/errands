jest.mock('../../lib/prisma', () => ({
  request: {
    findUnique: jest.fn()
  },
  message: {
    findMany: jest.fn(),
    create: jest.fn()
  }
}));

const prisma = require('../../lib/prisma');
const { getMessages, sendMessage } = require('./service');

const requestRecord = {
  id: 'request-1',
  listingId: 'listing-1',
  requesterId: 'rider-1',
  listing: { userId: 'owner-1' }
};

beforeEach(() => {
  jest.resetAllMocks();
  prisma.request.findUnique.mockResolvedValue(requestRecord);
});

describe('US-10 private request chat', () => {
  test('rejects reading a request that does not exist', async () => {
    prisma.request.findUnique.mockResolvedValue(null);

    const result = await getMessages('missing', 'rider-1');

    expect(result).toEqual({ error: 'NOT_FOUND' });
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  test('prevents an outsider from reading messages', async () => {
    const result = await getMessages('request-1', 'outsider-1');

    expect(result).toEqual({ error: 'FORBIDDEN' });
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  test('prevents an outsider from sending messages', async () => {
    const result = await sendMessage(
      'request-1',
      'outsider-1',
      'Hello'
    );

    expect(result).toEqual({ error: 'FORBIDDEN' });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  test.each(['rider-1', 'owner-1'])(
    'allows participant %s to read messages oldest first',
    async (userId) => {
      prisma.message.findMany.mockResolvedValue([
        { id: 'message-2', body: 'Second message' },
        { id: 'message-1', body: 'First message' }
      ]);

      const result = await getMessages('request-1', userId);

      expect(result.messages.map((message) => message.id))
        .toEqual(['message-1', 'message-2']);

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { requestId: 'request-1' },
          take: 100
        })
      );
    }
  );

  test.each(['', '   ', null, undefined, 123])(
    'rejects an empty or invalid message: %p',
    async (body) => {
      const result = await sendMessage(
        'request-1',
        'rider-1',
        body
      );

      expect(result).toEqual({ error: 'EMPTY_MESSAGE' });
      expect(prisma.message.create).not.toHaveBeenCalled();
    }
  );

  test('rejects messages longer than 2000 characters', async () => {
    const result = await sendMessage(
      'request-1',
      'rider-1',
      'a'.repeat(2001)
    );

    expect(result).toEqual({ error: 'MESSAGE_TOO_LONG' });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  test.each([
    ['rider-1', 'owner-1'],
    ['owner-1', 'rider-1']
  ])(
    'sends from %s to the correct recipient %s',
    async (senderId, receiverId) => {
      const savedMessage = {
        id: 'message-1',
        body: 'Hello'
      };

      prisma.message.create.mockResolvedValue(savedMessage);

      const result = await sendMessage(
        'request-1',
        senderId,
        '  Hello  '
      );

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            requestId: 'request-1',
            listingId: 'listing-1',
            senderId,
            receiverId,
            body: 'Hello'
          }
        })
      );

      expect(result).toEqual({ message: savedMessage });
    }
  );

  test('does not save a message for a missing request', async () => {
    prisma.request.findUnique.mockResolvedValue(null);

    const result = await sendMessage(
      'missing',
      'rider-1',
      'Hello'
    );

    expect(result).toEqual({ error: 'NOT_FOUND' });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});