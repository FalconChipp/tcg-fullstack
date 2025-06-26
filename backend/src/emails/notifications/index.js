import trade_offer from './trade_offer.js';
import trade_complete from './trade_complete.js';
import message from './message.js';
import listing_sold from './listing_sold.js';
import achievement_unlocked from './achievement_unlocked.js';
import chat_mention from './chat_mention.js';
import reminder from './reminder.js';
import warning from './warning.js';
import error from './error.js';
import system from './system.js';

const templates = {
  trade_offer,
  trade_complete,
  message,
  listing_sold,
  achievement_unlocked,
  chat_mention,
  reminder,
  warning,
  error,
  system,
};

export default function buildNotificationEmail(type, data) {
  const tpl = templates[type];
  if (!tpl) {
    console.warn(`[notifications] unknown email template: ${type}`);
    return null;
  }
  return tpl(data || {});
}
