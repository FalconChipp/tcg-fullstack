// src/emails/unreadMessageReminder.js

import emailBase from './emailBase.js';

export default function buildUnreadMessageReminder({ senderUsername, content }) {
  const preview = content.length > 80 ? content.slice(0, 77) + '...' : content;
  return {
    subject: `Unread message from ${senderUsername}`,
    html: emailBase({
      title: 'Unread Message Reminder',
      heading: 'You Have an Unread Message',
      content: `
        <p style="color:#464d6b;font-size:16px;line-height:1.6;margin:0 0 18px 0;">
          You have an unread message from <b>${senderUsername}</b>:
        </p>
        <blockquote style="color:#232346;font-size:16px;border-left:4px solid #2963FF;margin:0 0 20px;padding:0 0 0 12px;">
          ${preview}
        </blockquote>
        <p style="color:#464d6b;font-size:16px;line-height:1.6;margin:18px 0 0 0;">
          Log in to view and respond.
        </p>
      `,
      outro: 'This is an automated reminder from SixByFive TCG.',
    }),
  };
}
