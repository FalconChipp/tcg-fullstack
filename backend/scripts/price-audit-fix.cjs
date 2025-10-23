#!/usr/bin/env node
/* scripts/price-audit-fix.cjs
 * End-to-end auditor & fixer for price tables vs m_cards.
 *
 * WHAT IT DOES
 *  - Verifies DB connection env
 *  - Ensures constraints/indexes exist (idempotent)
 *  - Finds "orphan" rows (price rows whose card id is not in m_cards)
 *  - Attempts to repair orphans by normalizing id & variant
 *  - Optionally regenerates/merges card_price_cache from m_price_latest
 *
 * USAGE
 *  node scripts/price-audit-fix.cjs --dry        # read-only
 *  node scripts/price-audit-fix.cjs --fix        # repair ids/variants
 *  node scripts/price-audit-fix.cjs --rebuild-cache  # fill cache from latest
 *  node scripts/price-audit-fix.cjs --set sv08   # scope to a set code
 *  node scripts/price-audit-fix.cjs --fix --rebuild-cache --set sv08
 */

const mysql = require('mysql2/promise');

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_NAME = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'sixbyfiv_tcgstand',
  DB_USER = process.env.DB_USER || process.env.MYSQL_USER || 'sixbyfiv_tcgstand',
  DB_PASS = process.env.DB_PASS || process.env.MYSQL_PASSWORD || 'The0dore!',
} = process.env;

const argv = new Set(process.argv.slice(2));
const isDry = argv.has('--dry');
const doFix = argv.has('--fix');
const doRebuildCache = argv.has('--rebuild-cache');
const setFilter = (() => {
  const idx = process.argv.indexOf('--set');
  return idx > -1 ? String(process.argv[idx + 1] || '').trim() : null;
})();

function log(...args) { console.log('[price-audit]', ...args); }
function warn(...args) { console.warn('[price-audit][WARN]', ...args); }
function err(...args) { console.error('[price-audit][ERROR]', ...args); }

function normalizeVariantRaw(v) {
  if (!v) return 'normal';
  const s = String(v).toLowerCase().replace(/[\s_-]+/g, '');
  if (s === 'reverseholo' || s === 'reverseholofoil') return 'reverse';
  if (s === 'holofoil') return 'holo';
  if (s === 'firstedition') return 'firstEdition';
  return s; // 'normal', 'reverse', 'holo', 'foil', etc.
}

// Parse a card id generously, then reassemble in canonical form.
function parseAndNormalizeCardId(rawId) {
  if (!rawId) return null;
  const src = String(rawId).trim();
  const parts = src.split('-');
  if (parts.length < 2) return null;
  const set = parts.shift();
  const number = parts.join('-');
  const setCode = set.toLowerCase(); // canonical lower
  // number may have or lack zeroes; keep as-is (we’ll re-pad via m_cards)
  return { setCode, number };
}

async function connect() {
  const conn = await mysql.createConnection({
    host: DB_HOST, port: Number(DB_PORT),
    user: DB_USER, password: DB_PASS, database: DB_NAME,
    multipleStatements: true,
  });
  await conn.query('SELECT 1'); // ping
  return conn;
}

// Helper: does an index/constraint already exist?
async function hasConstraint(conn, table, constraint) {
  const [rows] = await conn.execute(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [DB_NAME, table, constraint]
  );
  return rows.length > 0;
}
async function hasIndex(conn, table, index) {
  const [rows] = await conn.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [DB_NAME, table, index]
  );
  return rows.length > 0;
}

async function ensureSchemaGuards(conn) {
  log('Ensuring FK & indexes...');

  // FK for card_price_cache.cardId -> m_cards(id) (if you want it strict)
  // NOTE: only add if column definitions match (VARCHAR(64) etc.)
  if (!(await hasConstraint(conn, 'card_price_cache', 'card_price_cache_fk_card'))) {
    try {
      await conn.execute(
        `ALTER TABLE card_price_cache
           ADD INDEX idx_cache_card (cardId),
           ADD INDEX idx_cache_card_variation (cardId, variation),
           ADD INDEX idx_cache_updatedAt (updatedAt)`
      );
      await conn.execute(
        `ALTER TABLE card_price_cache
           ADD CONSTRAINT card_price_cache_fk_card
           FOREIGN KEY (cardId) REFERENCES m_cards(id)
           ON DELETE CASCADE ON UPDATE CASCADE`
      );
      log('Added FK card_price_cache_fk_card and helpful indexes.');
    } catch (e) {
      warn('Could not add FK/indexes for card_price_cache:', e.message);
    }
  }

  // UNIQUE for m_price_latest(card_id, variant)
  if (!(await hasIndex(conn, 'm_price_latest', 'uniq_price_latest'))) {
    try {
      await conn.execute(
        `ALTER TABLE m_price_latest
           ADD UNIQUE KEY uniq_price_latest (card_id, variant)`
      );
      log('Added unique index uniq_price_latest on m_price_latest(card_id, variant).');
    } catch (e) {
      warn('Could not add uniq_price_latest:', e.message);
    }
  }

  // Helpful indexes if missing
  if (!(await hasIndex(conn, 'm_price_latest', 'idx_latest_card'))) {
    try {
      await conn.execute(
        `ALTER TABLE m_price_latest
           ADD INDEX idx_latest_card (card_id),
           ADD INDEX idx_latest_updated (updated_at)`
      );
      log('Added idx_latest_card, idx_latest_updated on m_price_latest.');
    } catch (e) {
      warn('Could not add indexes on m_price_latest:', e.message);
    }
  }
}

async function loadCardIdMap(conn, setCode = null) {
  const where = setCode ? 'WHERE set_code = ?' : '';
  const params = setCode ? [setCode] : [];
  const [rows] = await conn.execute(
    `SELECT id, set_code, number FROM m_cards ${where}`, params
  );

  // Build: canonical id -> true
  // And a lookup by (set_code, number-without-leading-zeros) -> canonical id
  const idSet = new Set();
  const byLooseKey = new Map();
  for (const r of rows) {
    idSet.add(r.id);
    const loose = `${r.set_code.toLowerCase()}::${String(r.number).replace(/^0+/, '')}`;
    byLooseKey.set(loose, r.id);
  }
  return { idSet, byLooseKey };
}

async function auditTable(conn, table, idColumn, variantColumn, providerColumn) {
  const [countAllRows] = await conn.execute(`SELECT COUNT(*) AS c FROM ${table}`);
  const total = countAllRows[0].c;

  const [orphans] = await conn.execute(
    `SELECT t.${idColumn} AS id, COUNT(*) AS n
       FROM ${table} t
  LEFT JOIN m_cards m ON m.id = t.${idColumn}
      WHERE m.id IS NULL
   GROUP BY t.${idColumn}
   ORDER BY n DESC
      LIMIT 500`
  );

  log(`Table ${table}: total rows=${total}, orphans=${orphans.length}`);

  const [badVariants] = await conn.execute(
    `SELECT ${variantColumn} AS v, COUNT(*) AS n
       FROM ${table}
   GROUP BY ${variantColumn}
   ORDER BY n DESC
      LIMIT 50`
  );

  return { total, orphans, badVariants };
}

async function tryRepairOrphans(conn, table, idColumn, variantColumn, { byLooseKey }) {
  const [rows] = await conn.execute(
    `SELECT t.${idColumn} AS badId, t.${variantColumn} AS badVar, t.*
       FROM ${table} t
  LEFT JOIN m_cards m ON m.id = t.${idColumn}
      WHERE m.id IS NULL
      LIMIT 1000`
  );

  if (!rows.length) {
    log(`No orphan rows to repair in ${table}.`);
    return { attempted: 0, fixed: 0 };
  }

  let attempted = 0;
  let fixed = 0;

  for (const r of rows) {
    attempted++;
    const parsed = parseAndNormalizeCardId(r[ idColumn ]);
    if (!parsed) continue;
    const looseKey = `${parsed.setCode}::${String(parsed.number).replace(/^0+/, '')}`;
    const canonicalId = byLooseKey.get(looseKey);
    if (!canonicalId) continue;

    const newVariant = normalizeVariantRaw(r[ variantColumn ]);

    if (isDry) {
      log(`[dry] Would repair ${table}.${idColumn} ${r[idColumn]} -> ${canonicalId}, variant -> ${newVariant}`);
      fixed++;
      continue;
    }

    try {
      await conn.execute(
        `UPDATE ${table}
            SET ${idColumn} = ?, ${variantColumn} = ?
          WHERE ${idColumn} = ? AND ${variantColumn} = ?`,
        [canonicalId, newVariant, r[idColumn], r[variantColumn]]
      );
      fixed++;
    } catch (e) {
      warn(`Failed to repair ${table} row ${r[idColumn]}:`, e.message);
    }
  }

  log(`Repair done for ${table}: attempted=${attempted}, fixed=${fixed}`);
  return { attempted, fixed };
}

async function rebuildCacheFromLatest(conn, { setCode = null } = {}) {
  // We’ll turn each latest (card_id, variant) into a cache row.
  // If provider is unknown, store provider NULL and upsert on (cardId, variation, provider).
  // Ensure a unique key exists to avoid dupes (done in ensureSchemaGuards).

  const where = setCode ? 'WHERE m.card_id LIKE ?' : '';
  const params = setCode ? [`${setCode}-%`] : [];
  const [rows] = await conn.execute(
    `SELECT m.card_id, m.variant,
            m.price_gbp, m.median_gbp, m.p10_gbp, m.p90_gbp, m.updated_at
       FROM m_price_latest m
      ${where}`, params
  );

  log(`Rebuilding card_price_cache from m_price_latest: rows=${rows.length} ${setCode ? `(set ${setCode})` : ''}`);

  let inserted = 0;
  for (const r of rows) {
    const cardId = r.card_id;
    const variation = normalizeVariantRaw(r.variant);
    const currency = 'GBP';
    const market = r.price_gbp ?? r.median_gbp ?? null;
    const mid = r.median_gbp ?? null;
    const low = r.p10_gbp ?? null;
    const high = r.p90_gbp ?? null;
    const updatedAt = r.updated_at;

    // Try ON DUPLICATE by (cardId, variation, provider)
    // If you don’t have such a unique key, the statement will still run but won’t dedupe.
    if (isDry) {
      log(`[dry] cache upsert ${cardId}/${variation} mid=${mid} market=${market}`);
      inserted++;
      continue;
    }

    try {
      await conn.execute(
        `INSERT INTO card_price_cache (cardId, variation, provider, currency, gbp, market, mid, low, high, createdAt, updatedAt)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, NOW(), ?)
         ON DUPLICATE KEY UPDATE
           currency = VALUES(currency),
           gbp      = VALUES(gbp),
           market   = VALUES(market),
           mid      = VALUES(mid),
           low      = VALUES(low),
           high     = VALUES(high),
           updatedAt= VALUES(updatedAt)`,
        [cardId, variation, currency, market ?? mid, market, mid, low, high, updatedAt]
      );
      inserted++;
    } catch (e) {
      warn(`cache upsert failed for ${cardId}/${variation}:`, e.message);
    }
  }

  log(`Cache rebuild complete. upserts=${inserted}`);
}

(async () => {
  log('DB:', { DB_HOST, DB_NAME, DB_USER });

  const conn = await connect();

  await ensureSchemaGuards(conn);

  const { idSet, byLooseKey } = await loadCardIdMap(conn, setFilter);
  log(`m_cards loaded: ${idSet.size} ids ${setFilter ? `(set=${setFilter})` : ''}`);

  // AUDIT m_price_latest
  const latestAudit = await auditTable(conn, 'm_price_latest', 'card_id', 'variant', null);
  // AUDIT card_price_cache
  const cacheAudit  = await auditTable(conn, 'card_price_cache', 'cardId', 'variation', 'provider');

  // REPAIR orphans
  if (doFix) {
    await tryRepairOrphans(conn, 'm_price_latest', 'card_id', 'variant', { byLooseKey });
    await tryRepairOrphans(conn, 'card_price_cache', 'cardId', 'variation', { byLooseKey });
  } else {
    log('Skipping repairs (run with --fix to enable).');
  }

  // REBUILD cache from latest (optional)
  if (doRebuildCache) {
    await rebuildCacheFromLatest(conn, { setCode: setFilter });
  }

  // FINAL audit again
  const latestAfter = await auditTable(conn, 'm_price_latest', 'card_id', 'variant', null);
  const cacheAfter  = await auditTable(conn, 'card_price_cache', 'cardId', 'variation', 'provider');

  log('Done.');
  await conn.end();
})().catch((e) => {
  err(e);
  process.exit(1);
});
