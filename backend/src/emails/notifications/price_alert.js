import emailBase from '../emailBase.js';

export default function build({
  title = 'Price Alert',
  body,
  linkUrl,
  cardId,
  variation,
  windowHours,
  condition,
  value,
  last,
  first,
}) {
  const details = [
    cardId ? `<li><strong>Card:</strong> ${cardId}${variation ? ` (${variation})` : ''}</li>` : null,
    condition ? `<li><strong>Condition:</strong> ${condition}</li>` : null,
    Number.isFinite(value) ? `<li><strong>Threshold:</strong> ${value}</li>` : null,
    Number.isFinite(windowHours) ? `<li><strong>Window:</strong> ${windowHours}h</li>` : null,
    Number.isFinite(first) ? `<li><strong>Start price:</strong> £${Number(first).toFixed(2)}</li>` : null,
    Number.isFinite(last) ? `<li><strong>Latest price:</strong> £${Number(last).toFixed(2)}</li>` : null,
  ].filter(Boolean);

  const detailsHtml = details.length
    ? `<ul style="color:#464d6b;font-size:14px;line-height:1.6;margin:16px 0;padding-left:18px;">${details.join(
        ''
      )}</ul>`
    : '';

  return {
    subject: title,
    html: emailBase({
      title,
      heading: title,
      content: `
        <p style="color:#464d6b;font-size:16px;line-height:1.6;">${body || ''}</p>
        ${detailsHtml}
        ${linkUrl ? `<p><a href="${linkUrl}">View card</a></p>` : ''}
      `,
    }),
  };
}
