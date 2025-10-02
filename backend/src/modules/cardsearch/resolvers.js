// src/modules/cardsearch/resolvers.js
// GraphQL resolvers for Card Search wired to shared services.
// NOTE: Works with or without GraphQL context; when no ctx.loaders is present,
// it falls back to direct DB reads.

import { Op } from "sequelize";
import {
  m_Set,
  m_Card,
  m_PriceLatest,
  m_PriceObservation,
  m_PriceRollup,
} from "../../models/index.js"; // <- ensure this path matches your project

import qb from "./services/queryBuilder.service.js";

const resolvers = {
  Query: {
    async searchCards(_, { input }) {
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
          images: (row.images ?? null) || {
            small: row.image_small ?? null,
            large: row.image_large ?? null,
          },
        };
      });

      return { total, limit, offset, items };
    },

    async cardById(_, { cardId }) {
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
        images: (r.images ?? null) || {
          small: r.image_small ?? null,
          large: r.image_large ?? null,
        },
      };
    },

    async priceLatest(_, { cardId, variant }) {
      const where = { card_id: cardId };
      if (variant) where.variant = String(variant).toLowerCase();

      const rows = await m_PriceLatest.findAll({ where, order: [["updated_at", "DESC"]] });
      return rows.map((r) => {
        const x = r.get();
        return {
          cardId: x.card_id,
          variant: x.variant,
          currency: x.currency,
          low: x.low ?? null,
          mid: x.mid ?? null,
          high: x.high ?? null,
          market: x.market ?? null,
          updatedAt: x.updated_at,
          provider: x.provider ?? null,
        };
      });
    },

    async priceRollups(_, { cardId, variant }) {
      const where = { card_id: cardId };
      if (variant) where.variant = String(variant).toLowerCase();

      const rows = await m_PriceRollup.findAll({
        where,
        order: [["window", "ASC"], ["end_date", "DESC"]],
      }).then((a) => a.map((r) => r.get()));

      if (!rows || rows.length === 0) return null;

      const out = {
        cardId,
        variant: rows[0].variant,
        currency: "GBP",
        latest: null,
        d1: null,
        d7: null,
        d30: null,
        d90: null,
      };

      for (const r of rows) {
        const windowObj = {
          startDate: r.start_date,
          endDate: r.end_date,
          count: r.count ?? 0,
          min: r.min ?? null,
          max: r.max ?? null,
          avg: r.avg ?? null,
          change: r.change ?? null,
          changePct: r.change_pct ?? null,
        };
        if (!out.latest && (r.latest_date || r.latest_mid || r.latest_market || r.latest_low || r.latest_high)) {
          out.latest = {
            date: r.latest_date ?? r.end_date ?? r.start_date,
            low: r.latest_low ?? null,
            mid: r.latest_mid ?? null,
            high: r.latest_high ?? null,
            market: r.latest_market ?? null,
          };
        }

        if (String(r.window) === "1") out.d1 = windowObj;
        else if (String(r.window) === "7") out.d7 = windowObj;
        else if (String(r.window) === "30") out.d30 = windowObj;
        else if (String(r.window) === "90") out.d90 = windowObj;
      }

      return out;
    },

    async priceObservations(_, { cardId, variant, startDate, endDate, limit = 365, offset = 0 }) {
      const where = { card_id: cardId };
      if (variant) where.variant = String(variant).toLowerCase();
      if (startDate) where.date = { ...(where.date || {}), [Op.gte]: startDate };
      if (endDate) where.date = { ...(where.date || {}), [Op.lte]: endDate };

      const rows = await m_PriceObservation.findAll({
        where,
        order: [["date", "ASC"]],
        limit: Math.max(1, Math.min(1000, Number(limit))),
        offset: Math.max(0, Number(offset)),
      });

      return rows.map((r) => {
        const x = r.get();
        return {
          cardId: x.card_id,
          variant: x.variant,
          date: x.date,
          currency: x.currency,
          low: x.low ?? null,
          mid: x.mid ?? null,
          high: x.high ?? null,
          market: x.market ?? null,
          provider: x.provider ?? null,
        };
      });
    },

    async setByCode(_, { code }) {
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

    async sets(_, { query, limit = 100, offset = 0 }) {
      const where = qb.buildSetWhere({ query });
      const rows = await m_Set.findAll({
        where,
        order: [["released_at", "DESC"]],
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
    async adminRunJob(_, { input }) {
      return {
        ok: true,
        message: `Job '${input.kind}' accepted.`,
        stats: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
    },

    async adminToggleSet(_, { code, enabled }) {
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

    async adminRebuildRollups(_, { set }) {
      return {
        ok: true,
        message: set ? `Rollups accepted for set ${set}` : "Global rollups accepted",
        stats: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
    },
  },

  Card: {
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

    async latestPrices(parent) {
      const rows = await m_PriceLatest.findAll({
        where: { card_id: parent.cardId },
        order: [["updated_at", "DESC"]],
      });
      return rows.map((r) => {
        const x = r.get();
        return {
          cardId: x.card_id,
          variant: x.variant,
          currency: x.currency,
          low: x.low ?? null,
          mid: x.mid ?? null,
          high: x.high ?? null,
          market: x.market ?? null,
          updatedAt: x.updated_at,
          provider: x.provider ?? null,
        };
      });
    },
  },
};

export default resolvers;
