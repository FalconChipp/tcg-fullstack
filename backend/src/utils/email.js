// src/utils/email.js
import nodemailer from 'nodemailer';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) =>
      `[${timestamp}] [${level}] ${message}`
    )
  ),
  transports: [new winston.transports.Console()],
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  secure: false,
});

/**
 * Send an HTML email (output from template builders).
 * @param {Object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 */
export async function sendMail({ to, subject, html }) {
  if (!to || !subject || !html) throw new Error('Missing email, subject, or html');
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'SixByFive TCG <noreply@sixbyfive.com>',
      to,
      subject,
      html,
    });
    logger.info(`[EMAIL] Sent to ${to} | Subject: ${subject}`);
    return true;
  } catch (err) {
    logger.error(`[EMAIL] Failed to send to ${to} | ${err.message}`);
    throw err;
  }
}
