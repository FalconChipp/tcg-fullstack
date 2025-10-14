// src/modules/cardsearch/resolvers.js
// GraphQL resolvers for Card Search wired to shared services.
// NOTE: Works with or without GraphQL context; when no ctx.loaders is present,
// it falls back to direct DB reads.

import {
  m_Set,
  m_Card,
  m_PriceLatest,
  m_PriceRollup,
  m_CardVariant,
} from "../../models/index.js"; // <- ensure this path matches your project

import qb from "./services/queryBuilder.service.js";
import { computeRollupsSnapshot } from "./services/rollup.service.js";
import { fetchPriceHistory } from "./services/history.service.js";

function buildHighResImageUrl(raw) {
  if (!raw) return null;
  let url = String(raw).trim();
  if (!url) return null;
  url = url.replace(/\\/g, '/').replace(/\/+$/, '');
  if (url.toLowerCase().endsWith('/high.webp')) return url;
  url = url.replace(/\.(png|jpe?g|webp)$/i, '');
  return url + '/high.webp';
}

function buildCardImages(row) {
  let source = row?.images?.large
    ?? row?.images?.small
    ?? row?.image_large
    ?? row?.image_small;
  if (!source) {
    const setCode = row?.setCode ?? row?.set_code ?? null;
    const number = row?.number ?? row?.cardNumber ?? null;
    if (setCode && number) {
      const family = setCode.replace(/[^a-z]/gi, '').toLowerCase() || setCode.toLowerCase();
      const normalizedSet = setCode.toLowerCase();
      source = `https://assets.tcgdex.net/en/${family}/${normalizedSet}/${number}`;
    }
  }
  const highRes = buildHighResImageUrl(source);

  if (!highRes) return { small: null, large: null };
  return { small: null, large: highRes };
}
const resolvers = {
  Query: {
    async cardsearchSearchCards(_, { input }) {
      const { where, order, limit, offset, include } = await qb.buildCardQuery(input);

      const total = await m_Card.count({ where });
      const rows = await m_Card.findAll({ where, order, limit, offset, include });

      const items = rows.map((r) => {
        const row = r.get();
        return {
          id: `${row.set_code}-${row.number}`,
          cardId: `${row.set_code}-${row.number}`,
          setCode: row.set_code,
          number: row.number,
          name: row.name,
          rarity: row.rarity ?? null,
          supertype: row.supertype ?? null,
          subtype: row.subtype ?? null,
          regulationMark: row.regulation_mark ?? null,
          illustrator: row.illustrator ?? null,
          images: buildCardImages(row),
        };
      });

      return { total, limit, offset, items };
    },

    async cardsearchCardById(_, { cardId }) {
      if (!cardId || typeof cardId !== "string" || !cardId.includes("-")) return null;
      const [set_code, ...rest] = cardId.split("-");
      const number = rest.join("-");
      const row = await m_Card.findOne({ where: { set_code, number } });
      if (!row) return null;
      const r = row.get();
      return {
        id: `${r.set_code}-${r.number}`,
        cardId: `${r.set_code}-${r.number}`,
        setCode: r.set_code,
        number: r.number,
        name: r.name,
        rarity: r.rarity ?? null,
        supertype: r.supertype ?? null,
        subtype: r.subtype ?? null,
        regulationMark: r.regulation_mark ?? null,
        illustrator: r.illustrator ?? null,
        images: buildCardImages(r),
      };
    },

    async cardsearchPriceLatest(_, { cardId, variant }) {
      const where = { card_id: cardId };
      if (variant) where.variant = String(variant).toLowerCase();

      const rows = await m_PriceLatest.findAll({ where, order: [["updated_at", "DESC"]] });
      return rows.map((r) => {
        const x = r.get();
        return {
          cardId: x.card_id,
          variant: x.variant,
          currency: x.currency ?? "GBP",
          low: x.low ?? null,
          mid: x.mid ?? null,
          high: x.high ?? null,
          market: x.market ?? null,
          updatedAt: x.updated_at,
          provider: x.provider ?? null,
        };
      });
    },

    async cardsearchPriceRollups(_, { cardId, variant, windows }) {
      if (!cardId) return null;
      return loadPriceRollups(cardId, variant, { windows });
    },

    async cardsearchPriceRollupsAll(_, { cardId, variants, windows }) {
      if (!cardId) return [];

      let variantList = Array.isArray(variants) && variants.length
        ? variants.map((v) => String(v).trim().toLowerCase()).filter(Boolean)
        : [];

      if (!variantList.length) {
        try {
          const rows = await m_CardVariant.findAll({
            where: { card_id: cardId },
            attributes: ["variant"],
            raw: true,
          });
          variantList = rows.length
            ? rows.map((row) => String(row.variant || 'normal').toLowerCase())
            : ['normal'];
        } catch {
          variantList = ['normal'];
        }
      }

      const seen = new Set();
      const unique = [];
      for (const key of variantList) {
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(key);
      }

      if (!unique.length) unique.push('normal');

      const opts = { windows };
      const out = [];
      for (const variantKey of unique) {
        const rollup = await loadPriceRollups(cardId, variantKey, opts);
        if (rollup) out.push(rollup);
      }

      return out;
    },
    async cardsearchPriceObservations(_, { cardId, variant, startDate, endDate, limit = 365, offset = 0 }) {
      if (!cardId) return [];

      const history = await fetchPriceHistory(cardId, {
        variant,
        startDate,
        endDate,
        limit: Math.max(1, Math.min(1000, Number(limit))),
        offset: Math.max(0, Number(offset)),
      });

      return history.map((row) => ({
        cardId,
        variant: row.variant ?? (variant ? String(variant).trim().toLowerCase() : null),
        date: row.date ?? null,
        currency: row.currency ?? "GBP",
        low: row.low ?? null,
        mid: row.mid ?? null,
        high: row.high ?? null,
        market: row.market ?? null,
        provider: row.provider ?? null,
      }));
    },

    async cardsearchSetByCode(_, { code }) {
      const row = await m_Set.findOne({ where: { code } });
      if (!row) return null;
      const r = row.get();
      return {
        code: r.code,
        abbr: r.abbr ?? null,
        name: r.name,
        series: r.series ?? null,
        releasedAt: r.released_at ?? null,
        total: r.total ?? null,
        lang: r.lang ?? null,
      };
    },

    async cardsearchSets(_, { query, limit = 100, offset = 0 }) {
      const where = qb.buildSetWhere({ query });
      const rows = await m_Set.findAll({
        where,
        order: [["release_date", "DESC"]],
        limit: Math.max(1, Math.min(500, Number(limit))),
        offset: Math.max(0, Number(offset)),
      });
      return rows.map((r) => {
        const x = r.get();
        return {
          code: x.code,
          abbr: x.abbr ?? null,
          name: x.name,
          series: x.series ?? null,
          releasedAt: x.released_at ?? null,
          total: x.total ?? null,
          lang: x.lang ?? null,
        };
      });
    },
  },

  Mutation: {
    async cardsearchAdminRunJob(_, { input }) {
      return {
        ok: true,
        message: `Job '${input.kind}' accepted.`,
        stats: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
    },

    async cardsearchAdminToggleSet(_, { code, enabled }) {
      const row = await m_Set.findOne({ where: { code } });
      if (!row) throw new Error(`Set not found: ${code}`);
      const r = row.get();
      return {
        set: {
          code: r.code,
          abbr: r.abbr ?? null,
          name: r.name,
          series: r.series ?? null,
          releasedAt: r.released_at ?? null,
          total: r.total ?? null,
          lang: r.lang ?? null,
        },
        hasCache: false,
        lastIngestAt: null,
        lastPriceCollectAt: null,
        lastRollupAt: null,
        cardCount: null,
        variantCount: null,
        latestCoveragePct: null,
        observationsCount: null,
        staleDays: null,
        enabled: !!enabled,
      };
    },

    async cardsearchAdminRebuildRollups(_, { set }) {
      return {
        ok: true,
        message: set ? `Rollups accepted for set ${set}` : "Global rollups accepted",
        stats: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
    },
  },

  CardsearchCard: {
    async set(parent) {
      const row = await m_Set.findOne({ where: { code: parent.setCode } });
      if (!row) return null;
      const r = row.get();
      return {
        code: r.code,
        abbr: r.abbr ?? null,
        name: r.name,
        series: r.series ?? null,
        releasedAt: r.released_at ?? null,
        total: r.total ?? null,
        lang: r.lang ?? null,
      };
    },

    async variants(parent) {
      // If you want this batched later, you can wire dataloaders back in;
      // for now direct read keeps it self-contained.
      const { m_CardVariant } = await import("../../models/index.js");
      const rows = await m_CardVariant.findAll({
        where: { card_id: parent.cardId },
        order: [["variant", "ASC"]],
      });
      return rows.map((r) => {
        const row = r.get();
        return {
          cardId: row.card_id,
          variant: row.variant,
          displayName: row.display_name ?? row.variant,
        };
      });
    },

    async priceRollups(parent, { variant, windows }) {
      const cardId = parent.cardId || parent.id || null;
      if (!cardId) return null;
      const requestedVariant = variant ?? parent.variant ?? null;
      return loadPriceRollups(cardId, requestedVariant, { windows });
    },

    async priceRollupsAll(parent, { variants, windows }) {
      const cardId = parent.cardId || parent.id || null;
      if (!cardId) return [];

      let variantList = Array.isArray(variants) && variants.length
        ? variants.map((v) => String(v).trim().toLowerCase()).filter(Boolean)
        : [];

      if (!variantList.length && Array.isArray(parent.variants) && parent.variants.length) {
        variantList = parent.variants
          .map((v) => (typeof v === 'string' ? v : v.variant))
          .filter(Boolean)
          .map((v) => String(v).toLowerCase());
      }

      if (!variantList.length) {
        try {
          const resolved = await resolvers.CardsearchCard.variants(parent);
          variantList = resolved.map((v) => String(v.variant || 'normal').toLowerCase());
        } catch {
          variantList = [];
        }
      }

      if (!variantList.length) variantList = ['normal'];

      const seen = new Set();
      const unique = [];
      for (const key of variantList) {
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(key);
      }

      if (!unique.length) unique.push('normal');

      const opts = { windows };
      const out = [];
      for (const variantKey of unique) {
        const rollup = await loadPriceRollups(cardId, variantKey, opts);
        if (rollup) out.push(rollup);
      }

      return out;
    },
    async latestPrices(parent) {
      const rows = await m_PriceLatest.findAll({
        where: { card_id: parent.cardId },
        order: [["updated_at", "DESC"]],
      });

      if (!rows.length) return [];

      const mapRow = (r) => {
        const x = r.get();
        return {
          cardId: x.card_id,
          variant: x.variant,
          currency: x.currency ?? "GBP",
          low: x.low ?? null,
          mid: x.mid ?? null,
          high: x.high ?? null,
          market: x.market ?? null,
          updatedAt: x.updated_at,
          provider: x.provider ?? null,
        };
      };

      const normalize = (value) => String(value ?? '').trim().toLowerCase();

      let allowed = null;
      if (Array.isArray(parent.variants) && parent.variants.length) {
        allowed = new Set(
          parent.variants
            .map((v) => (typeof v === 'string' ? v : v?.variant))
            .filter(Boolean)
            .map(normalize)
        );
      }

      if (!allowed || !allowed.size) {
        const variantRows = await m_CardVariant.findAll({
          where: { card_id: parent.cardId },
          attributes: ["variant"],
          raw: true,
        });
        if (variantRows.length) {
          allowed = new Set(
            variantRows
              .map((row) => normalize(row.variant))
              .filter(Boolean)
          );
        }
      }

      const prices = rows.map(mapRow);

      const dedupe = (list) => {
        const out = [];
        const seen = new Set();
        for (const item of list) {
          const key = normalize(item.variant);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(item);
        }
        return out;
      };

      if (allowed && allowed.size) {
        const filtered = [];
        const seen = new Set();
        for (const price of prices) {
          const key = normalize(price.variant);
          if (!allowed.has(key) || seen.has(key)) continue;
          seen.add(key);
          filtered.push(price);
        }
        if (filtered.length) return filtered;
      }

      return dedupe(prices);
    },
  },
};



function normalizeWindowList(value) {
  if (value == null) return null;
  const arr = Array.isArray(value) ? value : [value];
  const parsed = arr
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!parsed.length) return null;
  return Array.from(new Set(parsed)).sort((a, b) => a - b);
}

async function loadRollupsFromTable(cardId, variant, requestedWindows) {
  try {
    const rows = await m_PriceRollup.findAll({
      where: { card_id: cardId, variant },
      order: [["days", "ASC"], ["computed_at", "DESC"]],
      raw: true,
    });
    if (!rows || !rows.length) return null;

    const seen = new Set();
    const out = [];
    for (const row of rows) {
      const windowDays = Number(row.days ?? row.window ?? 0);
      if (!Number.isFinite(windowDays) || windowDays <= 0) continue;
      if (requestedWindows && requestedWindows.length && !requestedWindows.includes(windowDays)) continue;
      if (seen.has(windowDays)) continue;
      seen.add(windowDays);
      out.push({
        window: windowDays,
        days: windowDays,
        startDate: null,
        endDate: null,
        count: Number(row.count ?? 0),
        min: toNumber(row.min_gbp),
        max: toNumber(row.max_gbp),
        avg: toNumber(row.avg_gbp),
        change: toNumber(row.change_gbp ?? null),
        changePct: toNumber(row.change_pct ?? null),
        latest: toNumber(row.last_gbp ?? row.latest_gbp ?? null),
        latestDate: row.computed_at ? new Date(row.computed_at).toISOString().slice(0, 10) : null,
        computedAt: row.computed_at ?? null,
      });
    }
    return out;
  } catch (err) {
    console.warn?.(`priceRollups: table fallback failed for ${cardId}/${variant}: ${err?.message || err}`);
    return null;
  }
}

function mapComputedRollupRow(row) {
  const windowDays = Number(row.window ?? row.days ?? 0);
  if (!Number.isFinite(windowDays) || windowDays <= 0) return null;
  return {
    window: windowDays,
    days: windowDays,
    startDate: row.startDate ?? null,
    endDate: row.endDate ?? null,
    count: row.count ?? 0,
    min: toNumber(row.min),
    max: toNumber(row.max),
    avg: toNumber(row.avg),
    change: toNumber(row.change),
    changePct: toNumber(row.changePct),
    latest: toNumber(row.latest),
    latestDate: row.latestDate ?? null,
    computedAt: row.computedAt ?? null,
  };
}

async function loadPriceRollups(cardId, variant, { windows } = {}) {
  if (!cardId) return null;
  const requestedWindows = normalizeWindowList(windows);

  let resolvedVariant = variant ? String(variant).trim().toLowerCase() : null;
  if (!resolvedVariant) {
    try {
      const row = await m_CardVariant.findOne({
        where: { card_id: cardId },
        attributes: ["variant"],
        raw: true,
      });
      resolvedVariant = row ? String(row.variant || 'normal').toLowerCase() : 'normal';
    } catch {
      resolvedVariant = 'normal';
    }
  }

  let rows = null;
  try {
    const computed = await computeRollupsSnapshot(cardId, resolvedVariant, requestedWindows ? { windows: requestedWindows } : {});
    if (Array.isArray(computed) && computed.length) {
      const mapped = computed.map(mapComputedRollupRow).filter(Boolean);
      const hasMeaningfulHistory = mapped.some((r) => (r.count ?? 0) > 1 || (r.avg != null && (r.count ?? 0) > 0));
      const hasLatest = mapped.some((r) => r.latest != null);
      if (mapped.length && (hasMeaningfulHistory || hasLatest)) {
        rows = mapped;
      }
    }
  } catch (err) {
    console.warn?.(`priceRollups: compute failed for ${cardId}/${resolvedVariant}: ${err?.message || err}`);
  }

  if (!rows || !rows.length) {
    rows = await loadRollupsFromTable(cardId, resolvedVariant, requestedWindows) ?? [];
  }

  if (!rows.length) return null;

  if (requestedWindows && requestedWindows.length) {
    rows = rows.filter((r) => requestedWindows.includes(Number(r.window ?? r.days ?? 0)));
    if (!rows.length) return null;
  }

  return assembleRollup(cardId, resolvedVariant, rows);
}

function toNumber(value) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function assembleRollup(cardId, variant, rows) {
  if (!rows || !rows.length) return null;
  const normalizedVariant = String(variant || rows[0]?.variant || 'normal').toLowerCase();
  const out = {
    cardId,
    variant: normalizedVariant,
    currency: 'GBP',
    latest: null,
    d1: null,
    d7: null,
    d30: null,
    d90: null,
  };

  let latestCandidate = null;
  let latestDate = null;

  for (const r of rows) {
    const windowDays = Number(r.window ?? r.days ?? 0);
    const min = toNumber(r.min ?? r.min_gbp);
    const max = toNumber(r.max ?? r.max_gbp);
    const avg = toNumber(r.avg ?? r.avg_gbp);
    const change = toNumber(r.change ?? r.change_gbp);
    const changePct = toNumber(r.changePct ?? r.change_pct);
    const startDate = r.startDate ?? r.start_date ?? null;
    const endDate = r.endDate ?? r.end_date ?? null;
    const count = r.count ?? 0;

    const windowObj = {
      startDate,
      endDate,
      count,
      min,
      max,
      avg,
      change,
      changePct,
    };

    const rLatest = toNumber(r.latest ?? r.last_gbp ?? r.latest_market ?? r.latest_mid ?? avg);
    const rLatestDate = r.latestDate ?? r.latest_date ?? endDate ?? startDate ?? (r.computed_at ? new Date(r.computed_at).toISOString().slice(0, 10) : null);

    if (latestCandidate == null && rLatest != null) {
      latestCandidate = rLatest;
      latestDate = rLatestDate;
    }

    const key = String(windowDays);
    if (key === '1' && !out.d1) out.d1 = windowObj;
    else if (key === '7' && !out.d7) out.d7 = windowObj;
    else if (key === '30' && !out.d30) out.d30 = windowObj;
    else if (key === '90' && !out.d90) out.d90 = windowObj;
  }

  if (!out.latest && latestCandidate != null) {
    out.latest = {
      date: latestDate ?? null,
      low: null,
      mid: latestCandidate,
      high: null,
      market: latestCandidate,
    };
  }

  return out;
}

export default resolvers;












