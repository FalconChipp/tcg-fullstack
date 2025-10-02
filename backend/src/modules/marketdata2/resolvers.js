// src/modules/marketdata2/resolvers.js
import Fx from './services/fx.service.js';
import Providers from './services/providers.health.service.js';
import Scheduler from './services/scheduler.service.js';
import Jobs from './jobs/index.js';
import { listSets, getSetIndexEntry } from './services/setIndex.service.js';
import { searchCards as searchCardsSvc } from './services/searchCards.service.js';

export default {
  Query: {
    marketdataFx: async () => Fx.getFxRatesGBP(),
    marketdataProvidersHealth: async () => Providers.checkAll(),
    marketdataSets: async (_r, { era }) => {
      const sets = await listSets({ era });
      const out = [];
      for (const s of sets) {
        const idx = await getSetIndexEntry(s.setCode);
        out.push({
          setCode: s.setCode,
          abbr: idx?.abbr ?? s.abbr ?? null,
          name: idx?.name ?? s.name ?? s.setCode,
          era: idx?.era ?? s.era ?? null,
          cardsCount: idx?.cardsCount ?? null,
          variants: idx?.variants ?? [],
          cardsLastFetchedAt: idx?.cardsLastFetchedAt ?? null,
          cardsNextScheduledAt: idx?.cardsNextScheduledAt ?? null,
          pricesLastFetchedAt: idx?.pricesLastFetchedAt ?? null,
          pricesNextScheduledAt: idx?.pricesNextScheduledAt ?? null,
          priceSources: idx?.priceSources ?? [],
        });
      }
      return out;
    },

    // NEW: card search via cache -> DB fallback
    searchCards: async (_r, { input, offset = 0, limit = 50 }) => {
      return searchCardsSvc({ input: input || {}, offset, limit });
    },
  },

  Mutation: {
    marketdataTickMetadata: async (_r, { limit }) => Scheduler.metadataTick({ limit }),
    marketdataTickPricing: async (_r, { limit }) => Scheduler.pricingTick({ limit }),
    marketdataTickPatch: async (_r, args) => Scheduler.patchTick(args),

    marketdataCollectSet: async (_r, { setCode }) => Jobs.IngestSet.run({ setCode }),
    marketdataCollectPrices: async (_r, { setCode }) => Jobs.CollectPrices.run({ setCode }),
    marketdataCollectBoth: async (_r, { setCode }) => Jobs.CollectBoth.run({ setCode }),

    marketdataRefreshFx: async () => Fx.getFxRatesGBP({ force: true }),
  },
};
