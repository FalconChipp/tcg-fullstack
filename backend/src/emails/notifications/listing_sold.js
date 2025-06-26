import emailBase from '../emailBase.js';

export default function build({ title = 'Listing Sold', body, linkUrl }) {
  return {
    subject: title,
    html: emailBase({
      title,
      heading: title,
      content: `
        <p style="color:#464d6b;font-size:16px;line-height:1.6;">${body}</p>
        ${linkUrl ? `<p><a href="${linkUrl}">View Details</a></p>` : ''}
      `,
    }),
  };
}
