// src/emails/buildMfaEmail.js
import emailBase from './emailBase.js';

export default function buildMfaEmail({ username, mfaCode }) {
  return {
    subject: 'Your Two-Factor Authentication Code – SixByFive TCG',
    html: emailBase({
      title: 'Two-Factor Authentication Code',
      heading: 'Your Login Security Code',
      content: `
        <p style="color:#464d6b;font-size:16px;line-height:1.6;margin:0 0 18px 0;">
          Hello <b>${username}</b>,
        </p>
        <p style="color:#464d6b;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
          Here is your login security code:
        </p>
        <div style="text-align:center;margin:24px 0 18px 0;">
          <span style="
            background:#2963FF;
            color:#fff;
            font-size:26px;
            padding:14px 34px;
            border-radius:10px;
            font-weight:600;
            font-family:Raleway,Arial,sans-serif;
            letter-spacing:2px;">${mfaCode}</span>
        </div>
        <p style="color:#5f6570;font-size:14px;margin:0 0 16px 0;">
          This code will expire in a few minutes. If you did not attempt to log in, please secure your account.
        </p>
      `,
      outro: `Need help? Contact SixByFive TCG support.`,
    })
  };
}
