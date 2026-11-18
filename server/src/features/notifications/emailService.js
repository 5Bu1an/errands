const nodemailer = require('nodemailer');

async function sendNotificationEmail({ to, subject, text }) {
  if (
    process.env.NODE_ENV === 'test' ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    return null;
  }

  try {
    const port = Number(process.env.SMTP_PORT || 587);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    return await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text
    });
  } catch (error) {
    console.error(
      'Notification email failed:',
      error.code || 'EMAIL_ERROR'
    );
    return null;
  }
}

module.exports = { sendNotificationEmail };