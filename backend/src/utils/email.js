// src/utils/email.js

import 'dotenv/config'; // Ensures .env is loaded (must be at very top, before anything else)
import nodemailer from 'nodemailer';
import winston from 'winston';

// ----- ENVIRONMENT DEBUGGING -----
const smtpEnv = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465,
  user: process.env.SMTP_USER,
  passSet: !!process.env.SMTP_PASS,
  from: process.env.EMAIL_FROM,
};
if (!smtpEnv.host || !smtpEnv.user || !smtpEnv.passSet) {
  console.warn("[EMAIL][WARN] One or more SMTP env vars missing! Current:", smtpEnv);
}
else {
  console.log("[EMAIL] SMTP env loaded:", { ...smtpEnv, passSet: '[hidden]' });
}

// ----- LOGGER SETUP -----
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

// ----- TRANSPORTER -----
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  secure: true, // for port 465
});

// ----- MAIN SEND FUNCTION -----
/**
 * Send an HTML email (output from template builders).
 * @param {Object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 */
export async function sendMail({ to, subject, html }) {
  if (!to || !subject || !html) throw new Error('Missing email, subject, or html');

  logger.info(`[EMAIL] Preparing to send to ${to} | Subject: ${subject}`);

  try {
    logger.info('[EMAIL] Connecting to SMTP server...');
    await transporter.verify();
    logger.info('[EMAIL] SMTP server verified, sending email...');
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'SixByFive TCG <no-reply@sixbyfive.com>',
      to,
      subject,
      html,
    });
    logger.info(`[EMAIL] Sent to ${to} | Subject: ${subject}`);
    return true;
  } catch (err) {
    logger.error(`[EMAIL] Failed to send to ${to} | ${err.message}`);
    logger.error(`[EMAIL] Full error: ${err.stack || err}`);
    throw err;
  }
}
