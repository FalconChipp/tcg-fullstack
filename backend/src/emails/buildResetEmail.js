// src/emails/buildResetEmail.js
import emailBase from './emailBase.js';

export default function buildResetEmail({ username, token }) {
  const frontendUrl = `${process.env.FRONTEND_URL || 'https://tcg.sixbyfive.com'}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Reset your password – SixByFive TCG',
    html: emailBase({
      title: 'Reset Your Password',
      heading: 'Reset Password Request',
      content: `
        <p style="color:#464d6b;font-size:16px;line-height:1.6;margin:0 0 18px 0;">
          Hello <b>${username}</b>,
        </p>
        <p style="color:#464d6b;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
          We received a request to reset your password. Click the button below to proceed:
        </p>
        <div style="text-align:center;margin:28px 0 32px 0;">
          <a href="${frontendUrl}" style="
            background:#FF5252;
            color:#fff;
            text-decoration:none;
            display:inline-block;
            font-size:17px;
            padding:13px 34px;
            border-radius:10px;
            font-weight:600;
            font-family:Raleway,Arial,sans-serif;
            box-shadow:0 2px 6px #FF525233;
            letter-spacing:0.2px;">Reset Password</a>
        </div>
        <p style="color:#5f6570;font-size:14px;margin:0 0 16px 0;">
          Or copy and paste this link:<br>
          <span style="color:#548dff;font-size:13px;word-break:break-all;">${frontendUrl}</span>
        </p>
      `,
      outro: `If you did not request this, you can safely ignore this email.`,
    })
  };
}
