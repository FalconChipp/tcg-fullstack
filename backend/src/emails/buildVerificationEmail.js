// src/emails/buildVerificationEmail.js
import emailBase from './emailBase.js';

export default function buildVerificationEmail({ username, token }) {
  const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Verify your email address – SixByFive TCG',
    html: emailBase({
      title: 'Verify Your Email',
      heading: 'Verify Your Email Address',
      content: `
        <p style="color:#464d6b;font-size:16px;line-height:1.6;margin:0 0 18px 0;">
          Hello <b>${username}</b>,
        </p>
        <p style="color:#464d6b;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
          Welcome to <b>SixByFive TCG</b>! Please verify your email address by clicking the button below:
        </p>
        <div style="text-align:center;margin:28px 0 32px 0;">
          <a href="${frontendUrl}" style="
            background:#2963FF;
            color:#fff;
            text-decoration:none;
            display:inline-block;
            font-size:17px;
            padding:13px 34px;
            border-radius:10px;
            font-weight:600;
            font-family:Raleway,Arial,sans-serif;
            box-shadow:0 2px 6px #2963FF33;
            letter-spacing:0.2px;">Verify Email</a>
        </div>
        <p style="color:#5f6570;font-size:14px;margin:0 0 16px 0;">
          Or copy and paste this link:<br>
          <span style="color:#548dff;font-size:13px;word-break:break-all;">${frontendUrl}</span>
        </p>
      `,
      outro: `If you did not request this, please ignore this email.`,
    })
  };
}
