// src/tasks/updateCardPrices.js
// DAILY task to refresh card prices from PTCG; emails admin on failures/success
// ESM

import pLimit from 'p-limit';
import { Op } from 'sequelize';
import { Card } from '../models/index.js';
import {
  getCardPriceCache,
  saveCardPriceCache,
  tcgdexToPtcgId,
  withTimeout,
  log,
} from '../modules/search/helpers.js';
import { fetchPTCGCardPrices } from '../modules/search/api/pokemontcg.js';
import { saveOrUpdateCard } from '../modules/search/cardPersistence.js';
import { sendMail } from '../utils/email.js';
import { getExchangeRates } from '../modules/search/api/exchangeRates.js';

const PRICE_CONCURRENCY = Number(process.env.PRICE_CONCURRENCY || 6);
const PRICE_TIMEOUT_MS = Number(process.env.PRICE_FETCH_TIMEOUT_MS || 5000);
const BATCH_SIZE = Number(process.env.PRICE_BATCH_SIZE || 500);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const SEND_SUCCESS_EMAIL = (process.env.SEND_PRICE_SUCCESS_EMAIL || '1') !== '0';

/** Wrap the new variation map into the old vendor blob your persistence expects. */
function asVendorBlob(variationMap) {
  if (!variationMap || typeof variationMap !== 'object') return null;

  // tcgplayer: per-variation numbers { low, mid, high, market, directLow }
  const tcgplayerPrices = {};
  for (const [k, v] of Object.entries(variationMap)) {
    if (!v || typeof v !== 'object') continue;
    const entry = {};
    if (v.low != null) entry.low = v.low;
    if (v.mid != null) entry.mid = v.mid;
    if (v.high != null) entry.high = v.high;
    if (v.market != null) entry.market = v.market;
    if (v.directLow != null) entry.directLow = v.directLow;
    if (Object.keys(entry).length) tcgplayerPrices[k] = entry;
  }

  // cardmarket: single object with normal + reverse metrics
  const cm = {
    prices: {
      averageSellPrice: variationMap?.normal?.averageSellPrice ?? null,
      lowPrice: variationMap?.normal?.lowPrice ?? null,
      trendPrice: variationMap?.normal?.trendPrice ?? null,
      reverseHoloSell: variationMap?.reverse?.reverseHoloSell ?? null,
      reverseHoloLow: variationMap?.reverse?.reverseHoloLow ?? null,
      reverseHoloTrend: variationMap?.reverse?.reverseHoloTrend ?? null,
    },
  };

  const hasTgp = Object.keys(tcgplayerPrices).length > 0;
  const hasCm = Object.values(cm.prices).some((x) => x != null);

  if (!hasTgp && !hasCm) return null;
  return {
    tcgplayer: hasTgp ? { prices: tcgplayerPrices } : null,
    cardmarket: hasCm ? cm : null,
  };
}

/** Convert per-USD rates from exchangeRates.js to the *old* “per 1 GBP” shape. */
function toOldRatesShape(perUsd) {
  // perUsd.GBP = GBP per 1 USD, perUsd.EUR = EUR per 1 USD
  const g = Number(perUsd?.GBP);
  const e = Number(perUsd?.EUR);
  if (!(g > 0) || !(e > 0)) return null;

  // old shape wanted: USD per 1 GBP, EUR per 1 GBP
  // USD/GBP = 1 / (GBP/USD); EUR/GBP = (EUR/USD) / (GBP/USD)
  return {
    USD: 1 / g,
    EUR: e / g,
  };
}

export async function updateCardPricesDaily() {
  const report = {
    startedAt: new Date().toISOString(),
    updated: 0,
    skipped: 0,
    errors: [],
    rates: {},
    updatedCards: [], // { id, name }
  };

  // 1) FX (best-effort)
  try {
    const perUsdRates = await withTimeout(getExchangeRates(), 8000, 'fx-timeout');
    report.rates = toOldRatesShape(perUsdRates) || {};
  } catch (e) {
    report.errors.push(`Exchange rate error: ${e.message}`);
  }
  const ratesValid = Number(report.rates?.USD) > 0 && Number(report.rates?.EUR) > 0;
  if (!ratesValid) report.errors.push('Invalid exchange rates; GBP conversion skipped');

  // 2) Iterate cards in batches (avoid loading entire table in memory)
  const limit = pLimit(PRICE_CONCURRENCY);

  let offset = 0;
  for (;;) {
    const cards = await Card.findAll({
      order: [['id', 'ASC']],
      offset,
      limit: BATCH_SIZE,
      attributes: [
        'id',
        'name',
        'number',
        'set',
        'setName',
        'setLogo',
        'setSymbol',
        'image',
        'rarity',
        'edition',
        'variations',
        'pricing',
        'createdAt',
        'updatedAt',
      ],
    });
    if (!cards.length) break;
    offset += cards.length;

    await Promise.all(
      cards.map((card) =>
        limit(async () => {
          try {
            const cardId = card.id;

            // 2a) Price cache (fresh-only)
            let cache = await getCardPriceCache(cardId);

            // 2b) Live fetch if cache miss
            if (!cache) {
              const ptcgId = tcgdexToPtcgId(cardId);
              if (!ptcgId) {
                report.skipped++;
                return;
              }

              const rawMap = await withTimeout(
                fetchPTCGCardPrices(ptcgId), // returns variation map
                PRICE_TIMEOUT_MS,
                'price-timeout'
              ).catch(() => null);

              if (!rawMap) {
                report.skipped++;
                return;
              }

              // wrap new shape → old vendor blob (tcgplayer/cardmarket)
              const vendorBlob = asVendorBlob(rawMap);
              if (!vendorBlob) {
                report.skipped++;
                return;
              }

              await saveCardPriceCache(cardId, vendorBlob);
              cache = vendorBlob;
            }

            await saveOrUpdateCard(card.toJSON(), cache, ratesValid ? report.rates : null);

            report.updated++;
            report.updatedCards.push({ id: card.id, name: card.name || '' });
          } catch (e) {
            const err = `${card.id}: ${e.message}`;
            report.errors.push(err);
          }
        })
      )
    );
  }

  report.finishedAt = new Date().toISOString();

  // 3) Emails
  const hadFailures = report.errors.length > 0;
  if (ADMIN_EMAIL && hadFailures) {
    try {
      const html = `
        <h2>Daily Card Price Update – Failures</h2>
        <p><b>Updated:</b> ${report.updated} &nbsp; <b>Skipped:</b> ${report.skipped}</p>
        <p><b>Rates (old-shape):</b> ${report.rates ? JSON.stringify(report.rates) : 'n/a'}</p>
        <ul>${report.errors.map((s) => `<li>${s}</li>`).join('')}</ul>
        <p><i>Started:</i> ${report.startedAt}<br/><i>Finished:</i> ${report.finishedAt}</p>
      `;
      await sendMail({
        to: ADMIN_EMAIL,
        subject: 'Daily Card Price Update – Failures',
        html,
      });
    } catch (e) {
      console.error('[Email Error: failures]', e);
    }
  }

  // Success email (only if there were updates)
  if (ADMIN_EMAIL && SEND_SUCCESS_EMAIL && report.updatedCards.length) {
    try {
      const maxList = Math.min(report.updatedCards.length, 200); // keep it sane
      const listHtml = report.updatedCards
        .slice(0, maxList)
        .map((c) => `<li>${c.id}${c.name ? ` — ${escapeHtml(c.name)}` : ''}</li>`)
        .join('');
      const extra =
        report.updatedCards.length > maxList
          ? `<p>...and ${report.updatedCards.length - maxList} more.</p>`
          : '';

      const html = `
        <h2>Daily Card Price Update – Success</h2>
        <p><b>Updated:</b> ${report.updated} &nbsp; <b>Skipped:</b> ${report.skipped}</p>
        <p><b>Rates (old-shape):</b> ${report.rates ? JSON.stringify(report.rates) : 'n/a'}</p>
        <ol>${listHtml}</ol>
        ${extra}
        <p><i>Started:</i> ${report.startedAt}<br/><i>Finished:</i> ${report.finishedAt}</p>
      `;
      await sendMail({
        to: ADMIN_EMAIL,
        subject: 'Daily Card Price Update – Success',
        html,
      });
    } catch (e) {
      console.error('[Email Error: success]', e);
    }
  }

  console.log('[PRICES DAILY REPORT]', {
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    updated: report.updated,
    skipped: report.skipped,
    errors: report.errors.length,
  });

  return report;
}

/* tiny helper to avoid breaking emails with special chars */
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
