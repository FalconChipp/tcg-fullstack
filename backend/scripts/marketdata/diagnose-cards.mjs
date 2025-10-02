#!/usr/bin/env node
/**
 * scripts/marketdata/diagnose-cards.mjs
 *
 * Diagnose pricing lookup by hitting the exact PokémonTCG API endpoints your adapter would.
 *
 * Examples:
 *   node scripts/marketdata/diagnose-cards.mjs --set=sv10.5b --first=30
 *   node scripts/marketdata/diagnose-cards.mjs --set=sv10.5b --numbers=1,7,15,78
 *
 * Behavior:
 *   - If --numbers is provided, we fetch those numbers directly from the DB (no LIMIT).
 *   - Else we fetch the first N cards ordered by number (default --first=20).
 *   - For each card, we build/try candidate PokémonTCG ids and print status/latency,
 *     plus whether TCGplayer/Cardmarket pricing blocks exist.
 */

import "dotenv/config";
import process from "node:process";
import { Op } from "sequelize";
import { sequelize, m_Card } from "../../src/models/index.js";
import { tcgdexToPtcgId } from "../../src/modules/marketdata/sources/ptcg.adapter.js";

const args = process.argv.slice(2);
const setCode = (args.find(a => a.startsWith("--set=")) || "").split("=")[1] || null;
const first = Number((args.find(a => a.startsWith("--first=")) || "").split("=")[1] || 20);
const numbersArg = (args.find(a => a.startsWith("--numbers=")) || "").split("=")[1] || "";
const includeNumbers = numbersArg
  ? numbersArg.split(",").map(s => s.trim()).filter(Boolean)
  : null;

if (!setCode) {
  console.error("Usage: node scripts/marketdata/diagnose-cards.mjs --set=<code> [--first=20] [--numbers=1,2,20]");
  process.exit(1);
}

// helpers
const CARD_ID_RE = /^([a-z0-9.]+)-([a-z0-9]+)$/i;
function isValidCardId(id) {
  return typeof id === "string" && CARD_ID_RE.test(id);
}
function padCandidates(numStr) {
  const m = String(numStr).toLowerCase().match(/^(\d+)([a-z]*)$/i);
  const digits = m ? m[1] : numStr;
  const suffix = m ? (m[2] || "") : "";
  const unpadded = String(parseInt(digits, 10));
  const pad2 = digits.padStart(2, "0");
  const pad3 = digits.padStart(3, "0");
  return Array.from(new Set([
    suffix ? `${unpadded}${suffix}` : unpadded,
    suffix ? `${pad2}${suffix}`    : pad2,
    suffix ? `${pad3}${suffix}`    : pad3,
    unpadded, pad2, pad3,
  ]));
}

async function hit(url) {
  const headers = { accept: "application/json" };
  if (process.env.POKEMONTCG_API_KEY) headers["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  const started = Date.now();
  try {
    const res = await fetch(url, { headers });
    const dt = Date.now() - started;
    const status = res.status;
    let data = null;
    try { data = await res.json(); } catch { /* ignore parse errors */ }
    return { ok: res.ok, status, dt, data };
  } catch (e) {
    return { ok: false, status: 0, dt: Date.now() - started, error: e?.message || String(e) };
  }
}

(async () => {
  try {
    console.log(`\n[diagnose] set=${setCode}${includeNumbers ? ` numbers=${includeNumbers.join(",")}` : ` first=${first}`}`);

    // --- DB query strategy ---
    let cards = [];
    if (includeNumbers && includeNumbers.length) {
      // NEW: direct number filter, no limit
      cards = await m_Card.findAll({
        where: { set_code: setCode, number: { [Op.in]: includeNumbers } },
        raw: true,
        attributes: ["id", "number"],
        order: [["number", "ASC"]],
      });
    } else {
      // Fallback: first N by number
      cards = await m_Card.findAll({
        where: { set_code: setCode },
        raw: true,
        attributes: ["id", "number"],
        order: [["number", "ASC"]],
        limit: first,
      });
    }

    if (!cards.length) {
      console.warn(`[diagnose] No cards found for set ${setCode}${includeNumbers ? ` and numbers [${includeNumbers.join(", ")}]` : ""}.`);
      process.exit(0);
    }

    const invalid = cards.filter(c => !isValidCardId(c.id));
    if (invalid.length) {
      const sample = [...new Set(invalid.map(x => x.id))].slice(0, 8);
      console.warn(`[diagnose] WARN: ${invalid.length} cards have invalid card_id shape; samples: ${sample.join(", ")}`);
    }

    // Only process those with valid card ids
    const work = cards.filter(c => isValidCardId(c.id));
    for (const c of work) {
      const { id: tcgDexId, number } = c;

      // Build PTCG ids similar to the adapter’s logic
      const firstGuess = tcgdexToPtcgId(tcgDexId);  // may be null if mapping missing
      let idsToTry = [];
      if (firstGuess) {
        idsToTry.push(firstGuess);
        const [setId, base] = firstGuess.split("-");
        padCandidates(base).forEach(n => idsToTry.push(`${setId}-${n}`));
      }
      idsToTry = [...new Set(idsToTry)];

      let ok = false;
      for (const pid of idsToTry) {
        const url = `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(pid)}`;
        const r = await hit(url);
        const hasTP = !!r.data?.data?.tcgplayer?.prices;
        const hasCM = !!r.data?.data?.cardmarket?.prices;
        const tag = r.ok ? "OK" : "ERR";
        console.log(`[${tag}] ${r.status} ${r.dt}ms ${pid} tp=${hasTP} cm=${hasCM}`);
        if (r.ok) { ok = true; break; }
      }

      // If direct id lookups didn’t work, try a search by set.id + number
      if (!ok && firstGuess) {
        const setId = firstGuess.split("-")[0];
        const q = encodeURIComponent(`set.id:${setId} number:${number}`);
        const url = `https://api.pokemontcg.io/v2/cards?q=${q}`;
        const r = await hit(url);
        const count = Array.isArray(r.data?.data) ? r.data.data.length : 0;
        console.log(`[SEARCH] ${r.status} ${r.dt}ms set.id:${setId} number:${number} count=${count}`);
        if (count > 0) {
          // Optionally show the ids returned
          const ids = r.data.data.map(x => x.id).slice(0, 3);
          console.log(`         returned ids: ${ids.join(", ")}${r.data.data.length > 3 ? " ..." : ""}`);
        }
      }

      if (!firstGuess) {
        console.log(`[MAP] no mapping for ${tcgDexId} (set_code likely missing/incorrect in SetMapping)`);
      }
    }

    process.exit(0);
  } catch (e) {
    console.error("diagnose failed:", e);
    process.exit(1);
  }
})();
