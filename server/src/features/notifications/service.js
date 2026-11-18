const prisma = require('../../lib/prisma');
const { sendNotificationEmail } = require('./emailService');

async function listForUser(userId) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
}

// Send an email for an already-saved notification.
// Email failure must not undo the request or notification.
async function emailNotification({
  userId,
  message,
  title = 'Notification'
}) {
  if (
    process.env.NODE_ENV === 'test' ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    return;
  }

  try {
    const supabase = require('../../lib/supabase');
    const { data, error } =
      await supabase.auth.admin.getUserById(userId);

    if (error) {
      console.error('Notification recipient lookup failed.');
      return;
    }

    if (data?.user?.email) {
      await sendNotificationEmail({
        to: data.user.email,
        subject: `Errands: ${title}`,
        text: message
      });
    }
  } catch (error) {
    console.error('Notification email could not be delivered.');
  }
}

// For notifications created outside an existing transaction.
async function createNotification({
  userId,
  message,
  title = 'Notification'
}) {
  const notification = await prisma.notification.create({
    data: { userId, message }
  });

  await emailNotification({ userId, message, title });
  return notification;
}

// Save notifications inside the transaction;
// send their emails only after a successful commit.
async function withNotificationEmails(work) {
  const pendingEmails = [];

  const result = await prisma.$transaction(async (tx) => {
    async function notify({ data }) {
      const notification = await tx.notification.create({ data });
      pendingEmails.push({
        userId: data.userId,
        message: data.message
      });
      return notification;
    }

    return work(tx, notify);
  });

  if (!result?.error) {
    await Promise.all(pendingEmails.map(emailNotification));
  }

  return result;
}

module.exports = {
  listForUser,
  createNotification,
  emailNotification,
  withNotificationEmails
};