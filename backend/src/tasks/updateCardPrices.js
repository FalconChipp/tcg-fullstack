// src/tasks/updateCardPrices.js
// DAILY task to refresh card prices from PTCG; emails admin on failures/success
// ESM

import pLimit from 'p-limit';
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

// --------------------- Tunables (ENV overridable) ---------------------
const PRICE_CONCURRENCY = Number(process.env.PRICE_CONCURRENCY || 6);
const PRICE_TIMEOUT_MS = Number(
  process.env.PRICE_TIMEOUT_MS ??
  process.env.PRICE_FETCH_TIMEOUT_MS ??
  process.env.PROVIDER_TIMEOUT_MS ??
  6000
);
const PRICE_TIMEOUT_RETRY = (process.env.PRICE_TIMEOUT_RETRY ?? '1') !== '0'; // retry once on timeout/transient
const BATCH_SIZE = Number(process.env.PRICE_BATCH_SIZE || 500);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const SEND_SUCCESS_EMAIL = (process.env.SEND_PRICE_SUCCESS_EMAIL || '1') !== '0';

// limit diagnostic skip spam
const DEBUG_SKIP_LIMIT = Number(process.env.PRICE_DEBUG_SKIP_LIMIT || 20);

// --------------------- Helpers ---------------------

/** Normalize whatever fetchPTCGCardPrices returns into the vendor blob your persistence expects.
 * Supports BOTH:
 *  (A) "vendor blob" shape: { tcgplayer: {...}, cardmarket: {...} }
 *  (B) "variation map" shape: { normal: {...}, reverse: {...}, holofoil: {...}, ... }
 */
function asVendorBlob(input) {
  if (!input || typeof input !== 'object') return null;

  // Case A: already a vendor blob
  if (input.tcgplayer || input.cardmarket) {
    const tgp = input.tcgplayer && typeof input.tcgplayer === 'object' ? input.tcgplayer : null;
    const cm  = input.cardmarket && typeof input.cardmarket === 'object' ? input.cardmarket : null;

    const hasTgp =
      !!tgp &&
      (
        (tgp.prices && Object.keys(tgp.prices || {}).length > 0) ||
        Object.keys(tgp).some(k => typeof tgp[k] === 'object' && tgp[k] !== null)
      );

    const hasCm =
      !!cm &&
      (
        (cm.prices && Object.keys(cm.prices || {}).length > 0) ||
        Object.keys(cm).some(k => typeof cm[k] === 'object' && cm[k] !== null)
      );

    if (hasTgp || hasCm) {
      return { tcgplayer: hasTgp ? tgp : null, cardmarket: hasCm ? cm : null };
    }
    // fallthrough to try legacy mapping
  }

  // Case B: legacy “variation map” → synthesize vendor blob
  const tcgplayerPrices = {};
  for (const [k, v] of Object.entries(input)) {
    if (!v || typeof v !== 'object') continue;
    const entry = {};
    if (v.low != null) entry.low = v.low;
    if (v.mid != null) entry.mid = v.mid;
    if (v.high != null) entry.high = v.high;
    if (v.market != null) entry.market = v.market;
    if (v.directLow != null) entry.directLow = v.directLow;
    if (Object.keys(entry).length) tcgplayerPrices[k] = entry;
  }

  const cm = {
    prices: {
      averageSellPrice: input?.normal?.averageSellPrice ?? null,
      lowPrice:         input?.normal?.lowPrice ?? null,
      trendPrice:       input?.normal?.trendPrice ?? null,
      reverseHoloSell:  input?.reverse?.reverseHoloSell ?? null,
      reverseHoloLow:   input?.reverse?.reverseHoloLow ?? null,
      reverseHoloTrend: input?.reverse?.reverseHoloTrend ?? null,
    },
  };

  const hasTgp = Object.keys(tcgplayerPrices).length > 0;
  const hasCm  = Object.values(cm.prices).some(x => x != null);
  if (!hasTgp && !hasCm) return null;

  return {
    tcgplayer: hasTgp ? { prices: tcgplayerPrices } : null,
    cardmarket: hasCm ? cm : null,
  };
}

/** Convert per-USD rates from exchangeRates.js to the *old* “per 1 GBP” shape. */
function toOldRatesShape(perUsd) {
  const g = Number(perUsd?.GBP);
  const e = Number(perUsd?.EUR);
  if (!(g > 0) || !(e > 0)) return null;
  return { USD: 1 / g, EUR: e / g };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(ptcgId, timeoutMs) {
  // first attempt
  let errNote = 'unknown';
  try {
    return await withTimeout(fetchPTCGCardPrices(ptcgId), timeoutMs, 'price-timeout');
  } catch (e) {
    errNote = e?.message || 'fetch error';
    // only retry on timeouts or obvious transient network/server issues
    const transient =
      /timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|429|5\d\d|socket hang up|gateway/i.test(errNote || '');
    if (!PRICE_TIMEOUT_RETRY || !transient) throw e;
  }

  // jittered backoff + longer timeout for the second (and final) attempt
  const backoff = 300 + Math.floor(Math.random() * 400);
  await sleep(backoff);
  return withTimeout(fetchPTCGCardPrices(ptcgId), Math.max(timeoutMs * 2, 10000), 'price-timeout-2')
    .catch((e2) => {
      // rethrow with both attempt reasons for debugging
      const msg2 = e2?.message || 'second attempt failed';
      const combined = `retry failed: first=${errNote}; second=${msg2}`;
      const err = new Error(combined);
      err.cause = e2;
      throw err;
    });
}

// --------------------- Main job ---------------------

export async function updateCardPricesDaily() {
  // REENTRANCY GUARD: prevent overlapping runs
  if (updateCardPricesDaily._running) {
    const err = new Error('updateCardPricesDaily already running');
    err.code = 'E_RUNNING';
    throw err;
  }
  updateCardPricesDaily._running = true;

  const report = {
    startedAt: new Date().toISOString(),
    updated: 0,
    skipped: 0,
    errors: [],
    rates: {},
    updatedCards: [], // { id, name }
  };

  log?.info?.('[PRICES] Run started');

  try {
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
    let debugSkipsLogged = 0;

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
                  if (debugSkipsLogged < DEBUG_SKIP_LIMIT) {
                    debugSkipsLogged++;
                    log?.warn?.(`[PRICES][SKIP] No ptcgId mapping for cardId=${cardId}`);
                  }
                  return;
                }

                const raw = await fetchWithRetry(ptcgId, PRICE_TIMEOUT_MS).catch((e) => {
                  report.skipped++;
                  if (debugSkipsLogged < DEBUG_SKIP_LIMIT) {
                    debugSkipsLogged++;
                    log?.warn?.(
                      `[PRICES][SKIP] Fetch failed for ${ptcgId}: ${e?.message || 'unknown error'}`
                    );
                  }
                  return null;
                });

                if (!raw) return;

                // Normalize whatever we got into the vendor blob
                const vendorBlob = asVendorBlob(raw);
                if (!vendorBlob) {
                  report.skipped++;
                  if (debugSkipsLogged < DEBUG_SKIP_LIMIT) {
                    debugSkipsLogged++;
                    log?.warn?.(`[PRICES][SKIP] No usable prices in vendor blob (ptcgId OK)`);
                  }
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
              if (debugSkipsLogged < DEBUG_SKIP_LIMIT) {
                debugSkipsLogged++;
                log?.error?.(`[PRICES][ERR] ${err}`);
              }
            }
          })
        )
      );
    }

    report.finishedAt = new Date().toISOString();
    log?.info?.(
      `[PRICES] Run finished. Updated=${report.updated}, Skipped=${report.skipped}, Errors=${report.errors.length}`
    );

    // 3) Emails
    const hadFailures = report.errors.length > 0;
    if (ADMIN_EMAIL && hadFailures) {
      try {
        const html = `
          <h2>Daily Card Price Update – Failures</h2>
          <p><b>Updated:</b> ${report.updated} &nbsp; <b>Skipped:</b> ${report.skipped}</p>
          <p><b>Rates (old-shape):</b> ${report.rates ? JSON.stringify(report.rates) : 'n/a'}</p>
          <ul>${report.errors.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
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
          .map((c) => `<li>${escapeHtml(c.id)}${c.name ? ` — ${escapeHtml(c.name)}` : ''}</li>`)
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
  } finally {
    updateCardPricesDaily._running = false;
  }
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
