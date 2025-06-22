// src/email/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper: Send email
const sendMail = async ({ to, subject, html }) => {
  return transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to,
    subject,
    html,
  });
};

// === User Account Emails ===

// Email Verification
const verificationEmail = (user, token) => ({
  subject: 'Verify your SixByFive TCG account',
  html: `
    <h2>Welcome to SixByFive TCG, ${user.username}!</h2>
    <p>Click below to verify your email:</p>
    <a href="https://tcg.sixbyfive.com/verify?token=${token}">Verify Email</a>
    <p>If you did not sign up, you can ignore this.</p>
  `
});

// Password Reset
const passwordResetEmail = (user, token) => ({
  subject: 'Reset your SixByFive TCG password',
  html: `
    <h2>Password Reset</h2>
    <p>Click below to reset your password:</p>
    <a href="https://tcg.sixbyfive.com/reset?token=${token}">Reset Password</a>
    <p>If you did not request this, ignore this email.</p>
  `
});

// Email Change Verification
const verificationEmailChange = (user, token) => ({
  subject: 'Verify your new email address',
  html: `
    <h2>Email Change Request</h2>
    <p>Click below to verify your new email address:</p>
    <a href="https://tcg.sixbyfive.com/account/verify-email-change?token=${token}">Verify Email</a>
    <p>If you did not request this, you can ignore this email.</p>
  `
});

// 2FA Enabled
const twoFAEnabledEmail = (user) => ({
  subject: '2FA Enabled on Your SixByFive TCG Account',
  html: `
    <h2>2-Factor Authentication Enabled</h2>
    <p>You have successfully enabled 2FA on your account.</p>
    <p>If you did not do this, please reset your password immediately.</p>
  `
});

// 2FA Disabled
const twoFADisabledEmail = (user) => ({
  subject: '2FA Disabled on Your SixByFive TCG Account',
  html: `
    <h2>2-Factor Authentication Disabled</h2>
    <p>2FA has been disabled on your account.</p>
    <p>If you did not do this, please reset your password immediately.</p>
  `
});

// Account Deleted
const accountDeletedEmail = (user) => ({
  subject: 'Your SixByFive TCG Account Has Been Deleted',
  html: `
    <h2>Account Deleted</h2>
    <p>Your account has been permanently deleted per your request.</p>
    <p>If you did not request this, please contact support immediately.</p>
  `
});

// Data Export Request (GDPR)
const dataExportEmail = (user) => ({
  subject: 'Your SixByFive TCG Data Export',
  html: `
    <h2>Your Data Export is Ready</h2>
    <p>You requested a data export for your account.</p>
    <p>We will send your data to this address soon, or you can download it in your dashboard.</p>
  `
});

module.exports = {
  sendMail,
  verificationEmail,
  passwordResetEmail,
  verificationEmailChange,
  twoFAEnabledEmail,
  twoFADisabledEmail,
  accountDeletedEmail,
  dataExportEmail
};
