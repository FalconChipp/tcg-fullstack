// src/pages/sets/index.js
// Era ordering, search, and set listing for the Sets index page.

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Layout from "@/components/Layout/Layout";
import { getSetLogo } from "@/utils/setLogos";
import inferSetEra from "@/utils/setEra";
import executeServerGraphql from "@/utils/serverGraphql";
import { mapCacheSetSummary } from "@/utils/setDataTransforms";
import path from "path";

/* ---------------- Canonical era keys & labels (display only) ---------------- */
const ERA_LABELS = {
  wotc: "Wizards of the Coast",
  ecard: "e-Card",
  ex: "EX",
  dp: "Diamond & Pearl",
  hgss: "HeartGold & SoulSilver",
  bw: "Black & White",
  xy: "XY",
  sm: "Sun & Moon",
  swsh: "Sword & Shield",
  sv: "Scarlet & Violet",
  me: "Mega Evolutions",
  misc: "Special / Misc",
};

/* ---------------- Era priority: newest → oldest (promos first) ------------- */
const ERA_ORDER = [
  "me", // mega evolutions (newest era)
  "sv",
  "swsh",
  "sm",
  "xy",
  "bw",
  "hgss",
  "dp",
  "ex",
  "ecard",
  "wotc",
  "misc",
];

function eraRank(key) {
  const k = (key || "misc").toLowerCase();
  const idx = ERA_ORDER.indexOf(k);
  return idx === -1 ? ERA_ORDER.length - 1 : idx;
}

/* ---------------- Helper: promo-first, numeric code ordering ---------------- */
function isPromoCode(code) {
  if (!code) return false;
  const trimmed = String(code).trim().toLowerCase();
  return trimmed.endsWith("p") || trimmed.includes("promo");
}

function extractCodeNumber(code) {
  if (!code) return Number.POSITIVE_INFINITY;
  const match = String(code).toLowerCase().match(/(\d+(?:\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function compareByCode(a, b) {
  const codeA = String(a?.code || "").toLowerCase();
  const codeB = String(b?.code || "").toLowerCase();

  const promoA = isPromoCode(codeA) ? 0 : 1;
  const promoB = isPromoCode(codeB) ? 0 : 1;
  if (promoA !== promoB) return promoA - promoB;

  const numA = extractCodeNumber(codeA);
  const numB = extractCodeNumber(codeB);
  if (numA !== numB) return numA - numB;

  if (codeA && codeB) return codeA.localeCompare(codeB);
  if (codeA || codeB) return codeB ? -1 : 1;
  return 0;
}

function toFiniteOrNull(value) {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function resolveRepoPath(fs, ...segments) {
  const roots = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "..", ".."),
  ];

  for (const root of roots) {
    const candidate = path.join(root, ...segments);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/* ----------------------- Polished Set Logo chip ---------------------- */
function SetLogo({ name, code }) {
  const src = getSetLogo(name, code);
  return (
    <div
      className={[
        "relative w-28 h-28 sm:w-32 sm:h-32",
        "rounded-2xl overflow-hidden",
        "bg-light-alt dark:bg-dark-alt",
        "shadow-inner ring-1 ring-black/5 dark:ring-white/5",
        "before:content-[''] before:absolute before:inset-0",
        "before:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0)_65%)]",
        "dark:before:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_65%)]",
        "group-hover:scale-[1.02] group-hover:ring-black/10 dark:group-hover:ring-white/10 transition-transform",
      ].join(" ")}
    >
      <Image
        src={src}
        alt={`${name || code?.toUpperCase() || "Set"} logo`}
        fill
        sizes="(max-width: 640px) 112px, 128px"
        className="object-contain object-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] p-3"
        quality={90}
      />
    </div>
  );
}

/* --------------------------------- Page --------------------------------- */
export default function SetsPage({ sets }) {
  const enhanced = useMemo(
    () =>
      sets.map((set) => {
        const rawEra = (set.era || "").trim().toLowerCase();
        const era = ERA_LABELS[rawEra] ? rawEra : "misc";
        return {
          ...set,
          era,
        };
      }),
    [sets]
  );

  const [query, setQuery] = useState("");
  const [eraFilter, setEraFilter] = useState("all");

  const erasInData = useMemo(() => {
    const present = Array.from(new Set(enhanced.map((s) => s.era || "misc")));
    return present.sort((a, b) => eraRank(a) - eraRank(b));
  }, [enhanced]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byEra = new Map();

    for (const set of enhanced) {
      if (eraFilter !== "all" && set.era !== eraFilter) continue;

      if (q) {
        const name = (set.name || "").toLowerCase();
        const code = (set.code || "").toLowerCase();
        if (!name.includes(q) && !code.includes(q)) continue;
      }

      const key = set.era || "misc";
      if (!byEra.has(key)) byEra.set(key, []);
      byEra.get(key).push(set);
    }

    for (const arr of byEra.values()) {
      arr.sort(compareByCode);
    }

    const sections = Array.from(byEra.entries()).map(([key, items]) => ({
      eraKey: key,
      label: ERA_LABELS[key] || ERA_LABELS.misc,
      items,
    }));

    sections.sort((a, b) => eraRank(a.eraKey) - eraRank(b.eraKey));
    return sections;
  }, [enhanced, query, eraFilter]);

  return (
    <Layout
      seo={{
        title: "Pokémon TCG Sets | SixByFive TCG",
        description: "Browse every Pokémon TCG set with eras, quick filters, and search.",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-5 py-8 md:py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">
          Pokémon TCG Sets
        </h1>

        {/* Filters */}
        <div className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow border border-light-border dark:border-dark-border p-5 md:p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sets by name or code…"
              className="w-full border rounded-xl px-4 py-3 text-base bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder-light-textMuted dark:placeholder-dark-textMuted focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
              aria-label="Search sets"
            />
            <select
              value={eraFilter}
              onChange={(e) => setEraFilter(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-base bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
              aria-label="Filter by era"
            >
              <option value="all">All eras</option>
              {erasInData.map((key) => (
                <option key={key} value={key}>
                  {ERA_LABELS[key] || ERA_LABELS.misc}
                </option>
              ))}
            </select>
          </div>

          {/* Quick era pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setEraFilter("all")}
              className={[
                "px-3 py-1.5 rounded-xl text-sm border transition",
                eraFilter === "all"
                  ? "bg-light-accent dark:bg-dark-accent text-light-surface dark:text-dark-surface border-transparent"
                  : "bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border hover:border-light-accent dark:hover:border-dark-accent",
              ].join(" ")}
            >
              All
            </button>
            {erasInData.map((key) => (
              <button
                key={key}
                onClick={() => setEraFilter(key)}
                className={[
                  "px-3 py-1.5 rounded-xl text-sm border transition",
                  eraFilter === key
                    ? "bg-light-accent dark:bg-dark-accent text-light-surface dark:text-dark-surface border-transparent"
                    : "bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border hover:border-light-accent dark:hover:border-dark-accent",
                ].join(" ")}
                title={ERA_LABELS[key] || ERA_LABELS.misc}
              >
                {ERA_LABELS[key] || ERA_LABELS.misc}
              </button>
            ))}
          </div>
        </div>

        {/* Grouped sections */}
        {grouped.length === 0 ? (
          <div className="text-center text-light-textMuted dark:text-dark-textMuted py-16">
            No sets match your filters.
          </div>
        ) : (
          grouped.map(({ eraKey, label, items }) => (
            <section key={eraKey} className="mb-10">
              <h2 className="text-xl font-bold mb-4">{label}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                {items.map((set) => (
                  <Link key={set.code} href={`/sets/${set.code}`} className="group">
                    <div
                      className={[
                        "bg-light-surface dark:bg-dark-surface",
                        "rounded-2xl border border-light-border dark:border-dark-border",
                        "shadow hover:shadow-2xl transition p-5",
                        "flex flex-col items-center text-center",
                      ].join(" ")}
                    >
                      <SetLogo name={set.name} code={set.code} />
                      <h3 className="mt-3 text-lg font-semibold">{set.name}</h3>
                      <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-1">
                        Code: {set.code?.toUpperCase()}
                      </p>
                      <p className="text-xs text-light-textMuted dark:text-dark-textMuted">
                        Cards: {set.totalCards != null ? set.totalCards : "TBA"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </Layout>
  );
}

/* --------------------------- Static props --------------------------- */
const CARDSEARCH_SETS_QUERY = /* GraphQL */ `
  query CardsearchSetsForIndex($limit: Int!, $offset: Int!) {
    cardsearchSets(limit: $limit, offset: $offset) {
      code
      name
      abbr
      series
      total
    }
  }
`;

const CARDSEARCH_SETS_PAGE_SIZE = 250;
const CARDSEARCH_SETS_MAX_PAGES = 12;

async function loadSetsFromBackend() {
  const collected = [];
  let offset = 0;

  for (let page = 0; page < CARDSEARCH_SETS_MAX_PAGES; page += 1) {
    const data = await executeServerGraphql(CARDSEARCH_SETS_QUERY, {
      limit: CARDSEARCH_SETS_PAGE_SIZE,
      offset,
    });

    const chunk = Array.isArray(data?.cardsearchSets) ? data.cardsearchSets : [];
    if (chunk.length === 0) break;

    collected.push(...chunk);
    if (chunk.length < CARDSEARCH_SETS_PAGE_SIZE) break;
    offset += chunk.length;
  }

  if (!collected.length) return [];

  let fallbackTotals = null;
  try {
    const [cacheTotals, legacyTotals] = await Promise.allSettled([
      loadSetsFromCacheFiles(),
      loadSetsFromLegacyFiles(),
    ]);

    fallbackTotals = new Map();

    if (cacheTotals.status === "fulfilled") {
      for (const set of cacheTotals.value || []) {
        if (!set || !set.code) continue;
        const key = String(set.code).toLowerCase();
        if (!fallbackTotals.has(key)) {
          const total = toFiniteOrNull(set.totalCards);
          if (total != null) fallbackTotals.set(key, total);
        }
      }
    }

    if (legacyTotals.status === "fulfilled") {
      for (const set of legacyTotals.value || []) {
        if (!set || !set.code) continue;
        const key = String(set.code).toLowerCase();
        const total = toFiniteOrNull(set.totalCards);
        if (total != null && (!fallbackTotals.has(key) || fallbackTotals.get(key) == null)) {
          fallbackTotals.set(key, total);
        }
      }
    }

    if (!fallbackTotals.size) fallbackTotals = null;
  } catch (err) {
    console.warn("Unable to pre-load fallback totals:", err);
    fallbackTotals = null;
  }

  const seenCodes = new Set();
  const normalized = [];

  for (const set of collected) {
    if (!set || !set.code) continue;
    const code = String(set.code).trim();
    if (!code) continue;
    const key = code.toLowerCase();
    if (seenCodes.has(key)) continue;
    seenCodes.add(key);

    let totalCards = toFiniteOrNull(set.total);
    if (totalCards == null && fallbackTotals && fallbackTotals.has(key)) {
      const fallbackTotal = fallbackTotals.get(key);
      if (fallbackTotal != null) totalCards = fallbackTotal;
    }

    normalized.push({
      code,
      name: set.name || code.toUpperCase(),
      totalCards,
      era: inferSetEra(set),
      abbr: set.abbr ?? null,
      series: set.series ?? null,
    });
  }

  normalized.sort(compareByCode);
  return normalized;
}

async function loadSetsFromCacheFiles() {
  const fs = (await import("fs")).default || (await import("fs"));
  const CACHE_DIR = resolveRepoPath(fs, "backend", ".cache", "cardsearch", "sets");
  const sets = [];

  if (!CACHE_DIR || !fs.existsSync(CACHE_DIR)) return sets;

  try {
    const entries = fs.readdirSync(CACHE_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const code = entry.name;
      const filePath = path.join(CACHE_DIR, code, `${code}.json`);
      if (!fs.existsSync(filePath)) continue;
      try {
        const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const summary = mapCacheSetSummary(json);
        if (summary) sets.push(summary);
      } catch (err) {
        console.warn(`Failed to parse cache set '${code}':`, err);
      }
    }
  } catch (err) {
    console.warn("Unable to read backend cache sets:", err);
  }

  return sets;
}

async function loadSetsFromLegacyFiles() {
  const fs = (await import("fs")).default || (await import("fs"));
  const DATA_DIR = resolveRepoPath(fs, "public", "data");
  const sets = [];

  if (!DATA_DIR || !fs.existsSync(DATA_DIR)) return sets;

  try {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
        const json = JSON.parse(raw);
        const code = String(json.code || file.replace(/\.json$/i, "")).toLowerCase();
        sets.push({
          code,
          name: json.name || code.toUpperCase(),
          totalCards: json.totalCards ?? (Array.isArray(json.cards) ? json.cards.length : null),
          era: json.era || inferSetEra({ code, abbr: json.abbreviation }),
          abbr: json.abbreviation || null,
          series: json.series || null,
        });
      } catch (err) {
        console.warn(`Failed to parse legacy set '${file}':`, err);
      }
    }
  } catch (err) {
    console.warn("Unable to read legacy sets from /public/data:", err);
  }

  return sets;
}

async function loadSetsFromFiles() {
  const setsByCode = new Map();

  const collect = (list) => {
    for (const candidate of list) {
      if (!candidate || !candidate.code) continue;
      const key = String(candidate.code).toLowerCase();
      const incoming = { ...candidate, code: key };
      const incomingTotal = toFiniteOrNull(incoming.totalCards);
      const existing = setsByCode.get(key);
      if (!existing) {
        setsByCode.set(key, incoming);
        continue;
      }
      const existingTotal = toFiniteOrNull(existing.totalCards);
      if (incomingTotal != null && (existingTotal == null || incomingTotal > existingTotal)) {
        setsByCode.set(key, { ...existing, ...incoming, totalCards: incomingTotal });
      }
    }
  };

  collect(await loadSetsFromCacheFiles());
  collect(await loadSetsFromLegacyFiles());

  return Array.from(setsByCode.values()).sort(compareByCode);
}

export async function getStaticProps() {
  try {
    const sets = await loadSetsFromBackend();
    if (sets.length) {
      return { props: { sets } };
    }
    console.warn("GraphQL returned no sets; falling back to local data files.");
  } catch (err) {
    console.warn("Unable to load sets from GraphQL, falling back to local data files:", err);
  }

  const fallbackSets = await loadSetsFromFiles();
  return { props: { sets: fallbackSets } };
}
