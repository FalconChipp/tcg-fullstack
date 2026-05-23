// src/pages/sets/[code].js
import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/router";
import { devWarn } from "@/utils/devLog";
import Image from "next/image";
import Head from "next/head";
import Layout from "@/components/Layout/Layout";
import { getSetLogo } from "@/utils/setLogos";
import SetChecklistHeader from "@/components/Sets/SetChecklistHeader";
import useSetPrices from "@/hooks/useSetPrices";
import useSetOwned from "@/hooks/useSetOwned";
import inferSetEra from "@/utils/setEra";
import executeServerGraphql from "@/utils/serverGraphql";

/* -------------------- UI: Card Tile -------------------- */
function SetCardTile({ card, owned = false, price, eager = false }) {
  const hasImg = Boolean(card?.imageUrl);
  const priceStr =
    price && typeof price.gbp === "number" && price.gbp > 0
      ? `${price.currency || "£"}${price.gbp.toFixed(2)}`
      : null;

  return (
    <div
      className={[
        "bg-light-surface dark:bg-dark-surface",
        "rounded-2xl border border-light-border dark:border-dark-border",
        "shadow hover:shadow-2xl transition p-3 md:p-3.5",
        owned ? "ring-1 ring-emerald-500/40" : "",
      ].join(" ")}
      role="article"
      aria-label={card?.name || "Card"}
    >
      <div className="relative w-full aspect-[245/337] bg-light-alt dark:bg-dark-alt rounded-xl overflow-hidden">
        {hasImg ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-contain object-center"
            priority={eager}
            // @ts-ignore pass-through to <img>
            fetchPriority={eager ? "high" : "auto"}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-light-textMuted dark:text-dark-textMuted text-sm">
            No Image
          </div>
        )}

        {owned && (
          <span className="absolute top-2 right-2 rounded-full bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 shadow">
            Owned
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold truncate">{card.name}</p>
          <span className="text-xs text-light-textMuted dark:text-dark-textMuted whitespace-nowrap">
            #{card.number}
          </span>
        </div>
        <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-1 truncate">
          {card.rarity || "—"}
        </p>
        {priceStr && (
          <div className="mt-1.5 text-sm">
            <span className="font-bold text-light-accent dark:text-dark-accent">Market</span>
            <span className="font-semibold ml-1 text-light-text dark:text-dark-text">
              {priceStr}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Page component -------------------- */
function parseIntSafe(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

export default function SetPage() {
  const { query } = useRouter();
  const code = typeof query.code === "string" ? query.code.toLowerCase() : null;

  const [set, setSet] = useState(null);
  const [loadingSet, setLoadingSet] = useState(true);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("number-asc");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Fetch set data client-side so we don't depend on Netlify SSR reaching the backend
  useEffect(() => {
    if (!code) { setLoadingSet(false); return; }
    setLoadingSet(true);
    loadSetFromBackend(code)
      .then((data) => setSet(data))
      .catch((err) => devWarn("Failed to load set:", err))
      .finally(() => setLoadingSet(false));
  }, [code]);

  // Hooks: prices + owned/completion — pass empty stub while set is loading
  const setOrEmpty = set ?? { cards: [] };
  const { pricesById, totalSetPriceGbp } = useSetPrices(setOrEmpty);
  const { ownedSet, completedCount } = useSetOwned(setOrEmpty);

  // Rarity options (order: first-seen by card number)
  const rarityOptions = useMemo(() => {
    const getNum = (c) => {
      const m = String(c?.number ?? "").match(/\d+/);
      return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
    };
    const cards = Array.isArray(set?.cards) ? [...set.cards].sort((a, b) => getNum(a) - getNum(b)) : [];
    const seen = new Set();
    const ordered = [];
    for (const c of cards) {
      const r = (c?.rarity || "").trim();
      if (r && !seen.has(r)) {
        seen.add(r);
        ordered.push(r);
      }
    }
    return ordered;
  }, [set?.cards]);

  // Selected rarities
  const [selectedRarities, setSelectedRarities] = useState(() => new Set());
  const onToggleRarity = (r) =>
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  const onClearRarities = () => setSelectedRarities(new Set());

  // Build filtered/sorted list (text + rarity + sort)
  const view = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = Array.isArray(set?.cards) ? set.cards.slice() : [];

    if (q) {
      list = list.filter((c) => {
        const name = (c.name || "").toLowerCase();
        const num = String(c.number || "").toLowerCase();
        const rarity = (c.rarity || "").toLowerCase();
        return name.includes(q) || num.includes(q) || rarity.includes(q);
      });
    }

    if (selectedRarities.size > 0) {
      list = list.filter((c) => selectedRarities.has(c.rarity || ""));
    }

    list.sort((a, b) => {
      const aId = a.id || `${a.number}-${a.name}`;
      const bId = b.id || `${b.number}-${b.name}`;
      const aOwned = ownedSet.has(aId);
      const bOwned = ownedSet.has(bId);
      switch (sort) {
        case "owned-first":
          if (aOwned !== bOwned) return aOwned ? -1 : 1;
          return parseIntSafe(a.number) - parseIntSafe(b.number);
        case "number-asc":
          return parseIntSafe(a.number) - parseIntSafe(b.number);
        case "number-desc":
          return parseIntSafe(b.number) - parseIntSafe(a.number);
        case "name-asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name-desc":
          return (b.name || "").localeCompare(a.name || "");
        case "rarity-asc":
          return (a.rarity || "").localeCompare(b.rarity || "");
        case "rarity-desc":
          return (b.rarity || "").localeCompare(a.rarity || "");
        default:
          return 0;
      }
    });

    return list;
  }, [set?.cards, filter, selectedRarities, sort, ownedSet]);

  // Preload first row images (top ~10)
  const preloadImages = useMemo(() => {
    const first = view.slice(0, 10);
    return first.map((c) => c.imageUrl).filter(Boolean);
  }, [view]);

  const seoTitle = set?.name
    ? `${set.name} Checklist & Prices | SixByFive TCG`
    : `${String(code || "").toUpperCase()} Checklist | SixByFive TCG`;
  const seoDesc = set?.name
    ? `Browse the ${set.name} checklist with card numbers, rarity, and prices. Mark owned cards and track completion.`
    : `Checklist for set ${String(code || "").toUpperCase()} with card list, rarity, and prices.`;

  if (loadingSet) {
    return (
      <Layout seo={{ title: seoTitle, description: seoDesc }} noTopPadding={false}>
        <div className="mx-auto max-w-[1200px] px-5 py-8">
          <div className="h-10 w-64 bg-light-alt dark:bg-dark-alt rounded mb-6 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border dark:border-dark-border h-64 animate-pulse" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!set) {
    return (
      <Layout seo={{ title: "Set Not Found | SixByFive TCG", description: "" }} noTopPadding={false}>
        <div className="mx-auto max-w-[1200px] px-5 py-16 text-center">
          <p className="text-light-textMuted dark:text-dark-textMuted text-lg">Set not found.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout seo={{ title: seoTitle, description: seoDesc }} noTopPadding={false}>
      <Head>
        {preloadImages.map((src, i) => (
          <link key={i} rel="preload" as="image" href={src} />
        ))}
      </Head>

      <div className="mx-auto max-w-[1200px] px-5 py-8">
        <SetChecklistHeader
          name={set.name}
          code={set.code}
          logoUrl={getSetLogo(set.name, set.code)}
          totalCards={set.totalCards}
          completedCount={completedCount}
          filter={filter}
          setFilter={setFilter}
          sort={sort}
          setSort={setSort}
          cards={set.cards || []}
          advancedOpen={advancedOpen}
          setAdvancedOpen={setAdvancedOpen}
          selectedRarities={selectedRarities}
          onToggleRarity={onToggleRarity}
          onClearRarities={onClearRarities}
          /* show total set price in header */
          totalSetPriceGbp={totalSetPriceGbp}
        />

        <div className="mb-4 text-sm text-light-textMuted dark:text-dark-textMuted">
          Showing{" "}
          <span className="font-semibold text-light-text dark:text-dark-text">{view.length}</span>{" "}
          of{" "}
          <span className="font-semibold text-light-text dark:text-dark-text">
            {set.cards?.length || 0}
          </span>{" "}
          cards
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {view.map((card, idx) => {
            const id = card.id || `${card.number}-${card.name}`;
            const owned = ownedSet.has(id);
            const price = pricesById[id] || null;
            const eager = idx < 10;
            return (
              <SetCardTile key={id} card={card} owned={owned} price={price} eager={eager} />
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

/* -------------------- Data fetching (client-side) -------------------- */

// Combined query — fetches set metadata + first page of cards in ONE round trip.
const CARDSEARCH_SET_COMBINED_QUERY = /* GraphQL */ `
  query CardsearchSetPage($code: String!, $input: CardSearchInput!) {
    cardsearchSetByCode(code: $code) {
      code
      name
      abbr
      series
      total
    }
    cardsearchSearchCards(input: $input) {
      total
      items {
        cardId
        number
        name
        rarity
        images {
          large
        }
        latestPrices {
          variation
          gbp
          market
          mid
          low
          high
          currency
        }
        variants {
          key
          label
          default
        }
      }
    }
  }
`;

// Used only for subsequent pages when a set has >250 cards.
const CARDSEARCH_SET_CARDS_QUERY = /* GraphQL */ `
  query CardsearchSetCards($input: CardSearchInput!) {
    cardsearchSearchCards(input: $input) {
      total
      items {
        cardId
        number
        name
        rarity
        images {
          large
        }
        latestPrices {
          variation
          gbp
          market
          mid
          low
          high
          currency
        }
        variants {
          key
          label
          default
        }
      }
    }
  }
`;

const CARDSEARCH_SET_PAGE_SIZE = 250;
const CARDSEARCH_SET_MAX_PAGES = 12;

function mapLatestPrices(prices) {
  if (!Array.isArray(prices) || prices.length === 0) return null;
  const normalized = prices
    .map((price) => {
      if (!price) return null;
      return {
        variation: price?.variant ?? null,
        gbp: typeof price?.market === "number" ? price.market : null,
        tcgplayer: typeof price?.mid === "number" ? price.mid : null,
        cardmarket: typeof price?.low === "number" ? price.low : null,
        currency: price?.currency ?? null,
      };
    })
    .filter(Boolean);
  return normalized.length ? normalized : null;
}

async function loadSetFromBackend(code) {
  const codeParam = String(code || "").trim();
  if (!codeParam) return null;

  // First request: set metadata + page 1 of cards in a single round trip.
  const firstData = await executeServerGraphql(CARDSEARCH_SET_COMBINED_QUERY, {
    code: codeParam,
    input: { set: codeParam, limit: CARDSEARCH_SET_PAGE_SIZE, offset: 0 },
  });

  const setData = firstData?.cardsearchSetByCode;
  if (!setData) return null;

  const firstPayload = firstData?.cardsearchSearchCards;
  const firstItems = Array.isArray(firstPayload?.items) ? firstPayload.items : [];
  let reportedTotal = typeof firstPayload?.total === "number" ? firstPayload.total : null;

  const cards = [];
  const seenCards = new Set();

  // Process first page
  for (const item of firstItems) {
    if (!item) continue;
    const cardId = item.cardId || (item.number && `${codeParam}-${item.number}`);
    if (cardId && seenCards.has(cardId)) continue;
    if (cardId) seenCards.add(cardId);
    cards.push({
      id: cardId,
      number: item.number || "",
      name: item.name || "",
      rarity: item.rarity || null,
      imageUrl: item.images?.large || item.images?.small || null,
      prices: mapLatestPrices(item.latestPrices),
    });
  }

  // If all cards fit on page 1, we're done — no further requests needed.
  if (
    (typeof reportedTotal === "number" && cards.length >= reportedTotal) ||
    (firstItems.length < CARDSEARCH_SET_PAGE_SIZE && reportedTotal == null)
  ) {
    return buildSetResult(codeParam, setData, cards, reportedTotal);
  }

  // Rare case: set has >250 cards — fetch remaining pages.
  let offset = firstItems.length;
  for (let page = 1; page < CARDSEARCH_SET_MAX_PAGES; page += 1) {
    const res = await executeServerGraphql(CARDSEARCH_SET_CARDS_QUERY, {
      input: {
        set: codeParam,
        limit: CARDSEARCH_SET_PAGE_SIZE,
        offset,
      },
    });

    const payload = res?.cardsearchSearchCards;
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (typeof payload?.total === "number") reportedTotal = payload.total;
    if (items.length === 0) break;

    for (const item of items) {
      if (!item) continue;
      const cardId = item.cardId || (item.number && `${codeParam}-${item.number}`);
      if (cardId && seenCards.has(cardId)) continue;
      if (cardId) seenCards.add(cardId);
      cards.push({
        id: cardId,
        number: item.number || "",
        name: item.name || "",
        rarity: item.rarity || null,
        imageUrl: item.images?.large || item.images?.small || null,
        prices: mapLatestPrices(item.latestPrices),
      });
    }

    offset += items.length;
    if (typeof reportedTotal === "number" && cards.length >= reportedTotal) break;
    if (items.length < CARDSEARCH_SET_PAGE_SIZE && reportedTotal == null) break;
  }

  return buildSetResult(codeParam, setData, cards, reportedTotal);
}

function buildSetResult(code, setData, cards, reportedTotal) {
  const totalCards =
    typeof setData.total === "number"
      ? setData.total
      : typeof reportedTotal === "number"
        ? reportedTotal
        : cards.length || null;
  return {
    code: code.toLowerCase(),
    name: setData.name || code.toUpperCase(),
    abbr: setData.abbr ?? null,
    series: setData.series ?? null,
    era: inferSetEra(setData),
    totalCards: totalCards || cards.length || null,
    cards,
  };
}

// No getServerSideProps / getStaticProps needed — code comes from useRouter(),
// and set data is fetched client-side directly from the backend catalog.
