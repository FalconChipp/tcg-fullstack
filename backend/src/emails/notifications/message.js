import emailBase from '../emailBase.js';

export default function build({ title = 'New Message', body, linkUrl }) {
  return {
    subject: title,
    html: emailBase({
      title,
      heading: title,
      content: `
        <p style="color:#464d6b;font-size:16px;line-height:1.6;">${body}</p>
        ${linkUrl ? `<p><a href="${linkUrl}">Open Chat</a></p>` : ''}
      `,
    }),
  };
}
