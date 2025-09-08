// src/pages/sets/[code].js
import React, { useMemo, useState } from "react";
import Image from "next/image";
import Head from "next/head";
import Layout from "@/components/Layout/Layout";
import { getSetLogo } from "@/utils/setLogos";
import SetChecklistHeader from "@/components/Sets/SetChecklistHeader";
import useSetPrices from "@/hooks/useSetPrices";
import useSetOwned from "@/hooks/useSetOwned";
import path from "path";

/* -------------------- UI: Card Tile -------------------- */
function SetCardTile({ card, owned = false, price, eager = false }) {
  const hasImg = Boolean(card?.imageUrl);
  const priceStr =
    price && typeof price.gbp === "number"
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

export default function SetPage({ set }) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("number-asc");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Hooks: prices + owned/completion
  const { pricesById, totalSetPriceGbp } = useSetPrices(set);
  const { ownedSet, completedCount } = useSetOwned(set);

  // Rarity options (order: first-seen by card number)
  const rarityOptions = useMemo(() => {
    const getNum = (c) => {
      const m = String(c?.number ?? "").match(/\d+/);
      return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
    };
    const cards = Array.isArray(set.cards) ? [...set.cards].sort((a, b) => getNum(a) - getNum(b)) : [];
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
  }, [set.cards]);

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
    let list = Array.isArray(set.cards) ? set.cards.slice() : [];

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
  }, [set.cards, filter, selectedRarities, sort, ownedSet]);

  // Preload first row images (top ~10)
  const preloadImages = useMemo(() => {
    const first = view.slice(0, 10);
    return first.map((c) => c.imageUrl).filter(Boolean);
  }, [view]);

  const seoTitle = set?.name
    ? `${set.name} Checklist & Prices | SixByFive TCG`
    : `${set.code?.toUpperCase()} Checklist | SixByFive TCG`;
  const seoDesc = set?.name
    ? `Browse the ${set.name} checklist with card numbers, rarity, and prices. Mark owned cards and track completion.`
    : `Checklist for set ${set.code?.toUpperCase()} with card list, rarity, and prices.`;

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
          releaseDate={set.releaseDate}
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

/* -------------------- Data fetching (server) -------------------- */
export async function getStaticPaths() {
  const fs = (await import("fs")).default || (await import("fs"));
  const DATA_DIR = path.join(process.cwd(), "public", "data");
  let files = [];
  try {
    files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  } catch (err) {
    console.error("Error reading /public/data:", err);
  }
  const paths = files.map((file) => ({
    params: { code: file.replace(/\.json$/i, "") },
  }));
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  const fs = (await import("fs")).default || (await import("fs"));
  const DATA_DIR = path.join(process.cwd(), "public", "data");
  const file = path.join(DATA_DIR, `${params.code.toLowerCase()}.json`);
  if (!fs.existsSync(file)) return { notFound: true };
  const set = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!set.totalCards && Array.isArray(set.cards)) set.totalCards = set.cards.length;
  return { props: { set } };
}
