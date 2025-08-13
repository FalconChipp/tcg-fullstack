import pLimit from 'p-limit';
import { Card } from '../models/index.js';
import { getCardPriceCache, saveCardPriceCache } from '../modules/search/helpers.js';
import { fetchPTCGCardPrices } from '../modules/search/api/pokemontcg.js';
import { saveOrUpdateCard } from '../modules/search/cardPersistence.js';
import { tcgdexToPtcgId } from '../modules/search/helpers.js'; // adjust import path if needed
import { sendMail } from '../utils/email.js';
import { getExchangeRates } from '../modules/search/api/exchangeRates.js';

const PRICE_CONCURRENCY = Number(process.env.PRICE_CONCURRENCY || 6);
const PRICE_TIMEOUT_MS = Number(process.env.PRICE_FETCH_TIMEOUT_MS || 5000);

function withTimeout(promise, ms, label='timeout') {
  let t; const timer = new Promise((_, rej) => (t = setTimeout(() => rej(new Error(label)), ms)));
  return Promise.race([promise.finally(() => clearTimeout(t)), timer]);
}

export async function updateCardPricesDaily() {
  const report = { startedAt: new Date().toISOString(), updated: 0, skipped: 0, errors: [], rates: {} };
  const adminEmail = process.env.ADMIN_EMAIL;
  const failures = [];

  // 1) FX fetch
  try {
    report.rates = await withTimeout(getExchangeRates(), 8000, 'fx-timeout');
    console.log('[FX]', report.rates);
  } catch (e) {
    report.errors.push(`Exchange rate error: ${e.message}`);
  }

  const usdRate = Number(report.rates?.USD);
  const eurRate = Number(report.rates?.EUR);
  const ratesValid = usdRate > 0 && eurRate > 0;
  if (!ratesValid) {
    report.errors.push('Invalid exchange rates; GBP conversion skipped');
  }

  // 2) Iterate cards with concurrency
  const limit = pLimit(PRICE_CONCURRENCY);
  const allCards = await Card.findAll({ attributes: ['id','name','number','set','setName','setLogo','setSymbol','image','rarity','edition','variations','pricing','createdAt','updatedAt'] });

  await Promise.all(allCards.map(card => limit(async () => {
    try {
      const cardId = card.id;
      // Use fresh cache if present
      let cache = await getCardPriceCache(cardId);
      if (!cache) {
        const ptcgId = tcgdexToPtcgId(cardId);
        if (!ptcgId) { report.skipped++; return; }
        const prices = await withTimeout(fetchPTCGCardPrices(ptcgId), PRICE_TIMEOUT_MS, 'price-timeout').catch(() => null);
        if (!prices) { report.skipped++; return; }
        await saveCardPriceCache(cardId, prices);
        cache = prices;
      }

      await saveOrUpdateCard(card.toJSON(), cache, ratesValid ? report.rates : null);
      report.updated++;
    } catch (e) {
      const err = `${card.id}: ${e.message}`;
      report.errors.push(err);
      failures.push({ cardId: card.id, error: e.message });
    }
  }))); 

  report.finishedAt = new Date().toISOString();

  // 3) Email only if price fetch failures occurred
  if (adminEmail && failures.length) {
    try {
      const html = `
        <h2>Daily Card Price Update Errors</h2>
        <p><b>Rates (GBP→):</b> ${report.rates ? JSON.stringify(report.rates) : 'n/a'}</p>
        <ul>${failures.map(f => `<li>${f.cardId}: ${f.error}</li>`).join('')}</ul>
      `;
      await sendMail({ to: adminEmail, subject: 'Daily Card Price Update Errors', html });
    } catch (e) {
      console.error('[Email Error]', e);
    }
  }

  console.log('[PRICES DAILY REPORT]', report);
  return report;
}
