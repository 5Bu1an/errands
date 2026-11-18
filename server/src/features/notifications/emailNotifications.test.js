jest.mock('../../lib/prisma', () => ({
  $transaction: jest.fn(),
  notification: {
    create: jest.fn(),
    findMany: jest.fn()
  }
}));

jest.mock('../../lib/supabase', () => ({
  auth: {
    admin: {
      getUserById: jest.fn()
    }
  }
}));

jest.mock('./emailService', () => ({
  sendNotificationEmail: jest.fn()
}));

const prisma = require('../../lib/prisma');
const supabase = require('../../lib/supabase');
const { sendNotificationEmail } = require('./emailService');
const { withNotificationEmails } = require('./service');

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS
};

const notificationData = {
  userId: 'user-1',
  message: 'Your request was accepted.'
};

beforeEach(() => {
  jest.resetAllMocks();

  // All external services are mocked: no real emails are sent.
  process.env.NODE_ENV = 'development';
  process.env.SMTP_USER = 'sender@example.com';
  process.env.SMTP_PASS = 'fake-test-password';

  prisma.notification.create.mockResolvedValue({ id: 'notification-1' });

  supabase.auth.admin.getUserById.mockResolvedValue({
    data: { user: { email: 'recipient@example.com' } },
    error: null
  });

  sendNotificationEmail.mockResolvedValue({ messageId: 'email-1' });

  prisma.$transaction.mockImplementation(async (callback) => {
    const result = await callback(prisma);

    // The callback has finished, but the transaction hasn't returned.
    expect(sendNotificationEmail).not.toHaveBeenCalled();

    return result;
  });

  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

async function saveNotification() {
  return withNotificationEmails(async (tx, notify) => {
    await notify({ data: notificationData });
    return { success: true };
  });
}

test('sends email after the transaction commits', async () => {
  await expect(saveNotification()).resolves.toEqual({ success: true });

  expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
  expect(sendNotificationEmail).toHaveBeenCalledWith({
    to: 'recipient@example.com',
    subject: 'Errands: Notification',
    text: notificationData.message
  });
});

test('does not send email when the transaction fails', async () => {
  prisma.$transaction.mockImplementation(async (callback) => {
    await callback(prisma);
    throw new Error('Commit failed');
  });

  await expect(saveNotification()).rejects.toThrow('Commit failed');
  expect(sendNotificationEmail).not.toHaveBeenCalled();
});

test('email failure does not fail the committed operation', async () => {
  sendNotificationEmail.mockRejectedValue(new Error('SMTP unavailable'));

  await expect(saveNotification()).resolves.toEqual({ success: true });
  expect(sendNotificationEmail).toHaveBeenCalledTimes(1);
});

test('recipient lookup failure does not fail the operation', async () => {
  supabase.auth.admin.getUserById.mockResolvedValue({
    data: null,
    error: { message: 'Lookup failed' }
  });

  await expect(saveNotification()).resolves.toEqual({ success: true });
  expect(sendNotificationEmail).not.toHaveBeenCalled();
});

test('missing SMTP settings skips email but saves notification', async () => {
  delete process.env.SMTP_USER;

  await expect(saveNotification()).resolves.toEqual({ success: true });

  expect(prisma.notification.create).toHaveBeenCalledWith({
    data: notificationData
  });
  expect(supabase.auth.admin.getUserById).not.toHaveBeenCalled();
  expect(sendNotificationEmail).not.toHaveBeenCalled();
});