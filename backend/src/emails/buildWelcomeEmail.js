// src/emails/buildWelcomeEmail.js
import emailBase from './emailBase.js';

export default function buildWelcomeEmail({ username }) {
  return {
    subject: 'Welcome to SixByFive TCG!',
    html: emailBase({
      title: 'Welcome!',
      heading: 'Your SixByFive TCG Account Is Ready',
      content: `
        <p style="color:#464d6b;font-size:16px;line-height:1.6;margin:0 0 18px 0;">
          Hello <b>${username}</b>,
        </p>
        <p style="color:#464d6b;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
          We're excited to have you on board! Your account is ready to use. You can now log in and start building your collection, trading cards, and exploring our community.
        </p>
        <p style="color:#5f6570;font-size:14px;margin:0 0 16px 0;">
          Need help? Visit our Help Center or contact support any time.
        </p>
      `,
      outro: `Thank you for joining SixByFive TCG!`,
    })
  };
}
