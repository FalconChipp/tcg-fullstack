// src/pages/sets/index.js
// Era ordering, search, and set listing for the Sets index page.

import React, { useMemo, useState } from "react";
import { devWarn } from "@/utils/devLog";
import Link from "next/link";
import Image from "next/image";
import Layout from "@/components/Layout/Layout";
import { getSetLogo } from "@/utils/setLogos";
import inferSetEra from "@/utils/setEra";
import executeServerGraphql from "@/utils/serverGraphql";
import { mapCacheSetSummary } from "@/utils/setDataTransforms";
import { normalizeSearchText } from "@/utils/normalizeSearchText";
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

/* ---------------- Era banner artwork (optional, drop-in) ---------------- */
// Per-era crop position for the banner art — artwork composition varies
// (logo wordmarks, character placement), so each era can override the
// default. Add an entry here when a new banner's default crop looks off.
const ERA_BANNER_POSITION_OVERRIDES = {
  sv: "center 0%",
  swsh: "center 80%",
  sm: "center 40%",
  xy: "center 30%",
  bw: "center 40%",
};
const ERA_BANNER_DEFAULT_POSITION = "center 30%";

function eraBannerPosition(eraKey) {
  return ERA_BANNER_POSITION_OVERRIDES[eraKey] || ERA_BANNER_DEFAULT_POSITION;
}

// Put a file named "<era-key>.jpg" (or .png/.webp) in
// public/assets/era-banners/ — e.g. "sv.jpg", "swsh.png" — and it's picked
// up automatically as that era's banner background. Eras without a file
// fall back to the set-logo collage.
const ERA_BANNER_DIR = "assets/era-banners";
const ERA_BANNER_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

function loadEraBannerMap(fs, publicDir) {
  const map = {};
  const dir = path.join(publicDir, ERA_BANNER_DIR);
  if (!fs.existsSync(dir)) return map;

  try {
    for (const key of Object.keys(ERA_LABELS)) {
      for (const ext of ERA_BANNER_EXTENSIONS) {
        const filePath = path.join(dir, `${key}.${ext}`);
        if (fs.existsSync(filePath)) {
          map[key] = `/${ERA_BANNER_DIR}/${key}.${ext}`;
          break;
        }
      }
    }
  } catch (err) {
    devWarn("Unable to read era banner assets:", err);
  }

  return map;
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

/* ----------------------- Flat set logo tile ---------------------- */
function SetLogo({ name, code }) {
  const src = getSetLogo(name, code);
  return (
    <div className="relative h-20 w-20 flex-none overflow-hidden rounded-[6px] bg-vault-raised">
      <Image
        src={src}
        alt={`${name || code?.toUpperCase() || "Set"} logo`}
        fill
        sizes="80px"
        className="object-contain object-center p-2.5"
        quality={90}
      />
    </div>
  );
}

/* --------------------------------- Page --------------------------------- */
export default function SetsPage({ sets, eraBanners = {} }) {
  const enhanced = useMemo(
    () =>
      sets.map((set) => {
        const rawEra = (set.era || "").trim().toLowerCase();

        let era = ERA_LABELS[rawEra] ? rawEra : "misc";

        const code = (set.code || "").trim().toLowerCase();
        const series = (set.series || "").trim().toLowerCase();

        if (
          (series.includes("scarlet") && series.includes("violet")) ||
          code.startsWith("sv")
        ) {
          era = "sv";
        }

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
    const q = normalizeSearchText(query);
    const byEra = new Map();

    for (const set of enhanced) {
      if (eraFilter !== "all" && set.era !== eraFilter) continue;

      if (q) {
        const name = normalizeSearchText(set.name);
        const code = normalizeSearchText(set.code);
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
      <div className="min-h-screen bg-vault-bg">
        {/* HERO / INTRO */}
        <section className="w-full border-b border-vault-border px-5 pt-16 pb-10 sm:px-7">
          <div className="mx-auto max-w-7xl">
            <p className="mb-4 font-vault-body text-[11px] font-semibold uppercase tracking-[0.08em] text-vault-textTertiary">
              Catalog · Every era
            </p>

            <h1 className="font-vault text-[36px] font-semibold leading-[1.15] tracking-tight text-vault-text sm:text-[42px]">
              Pokémon TCG Sets
            </h1>

            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-vault-textSecondary">
              Every expansion, grouped by era, for discovery into a set&apos;s
              full checklist.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-7">
          {/* Filters */}
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-vault-textTertiary">
                <SearchGlyph />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sets by name or code…"
                className="w-full rounded-[10px] border border-vault-border bg-vault-surface py-2.5 pl-10 pr-4 text-[15px] text-vault-text placeholder-vault-textTertiary outline-none transition-colors focus:border-vault-accent"
                aria-label="Search sets"
              />
            </div>

            <select
              value={eraFilter}
              onChange={(e) => setEraFilter(e.target.value)}
              className="rounded-[10px] border border-vault-border bg-vault-surface px-4 py-2.5 text-[15px] text-vault-text outline-none transition-colors focus:border-vault-accent sm:w-56"
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

          {/* Quick era chips */}
          <div className="mb-12 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEraFilter("all")}
              className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                eraFilter === "all"
                  ? "bg-vault-accent text-vault-text"
                  : "bg-vault-raised text-vault-textSecondary hover:text-vault-text"
              }`}
            >
              All
            </button>
            {erasInData.map((key) => (
              <button
                type="button"
                key={key}
                onClick={() => setEraFilter(key)}
                title={ERA_LABELS[key] || ERA_LABELS.misc}
                className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  eraFilter === key
                    ? "bg-vault-accent text-vault-text"
                    : "bg-vault-raised text-vault-textSecondary hover:text-vault-text"
                }`}
              >
                {ERA_LABELS[key] || ERA_LABELS.misc}
              </button>
            ))}
          </div>

          {/* Grouped sections */}
          {grouped.length === 0 ? (
            <div className="py-16 text-center text-sm text-vault-textTertiary">
              No sets match your filters.
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map(({ eraKey, label, items }) => (
                <section
                  key={eraKey}
                  className="overflow-hidden rounded-[14px] border border-vault-border bg-vault-surface"
                >
                  {/* Era banner — real artwork if supplied, logo collage otherwise */}
                  <div className="relative h-36 overflow-hidden border-b border-vault-border bg-vault-raised sm:h-40">
                    {eraBanners[eraKey] ? (
                      <Image
                        src={eraBanners[eraKey]}
                        alt=""
                        fill
                        sizes="100vw"
                        className="object-cover"
                        style={{ objectPosition: eraBannerPosition(eraKey) }}
                        priority={false}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-end gap-4 pr-4 opacity-50">
                        {items.slice(0, 5).map((set) => (
                          <div key={set.code} className="relative h-24 w-24 flex-none sm:h-28 sm:w-28">
                            <Image
                              src={getSetLogo(set.name, set.code)}
                              alt=""
                              fill
                              sizes="112px"
                              className="object-contain object-center"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-r from-vault-bg via-vault-bg/85 to-vault-bg/10" />

                    <div className="relative flex h-full flex-col justify-center px-5 sm:px-6">
                      <p className="font-vault-body text-[11px] font-semibold uppercase tracking-[0.1em] text-vault-accent">
                        Era
                      </p>
                      <div className="mt-1 flex items-baseline gap-3">
                        <h2 className="font-vault text-2xl font-semibold text-vault-text">
                          {label}
                        </h2>
                        <span className="flex-none text-[13px] text-vault-textTertiary">
                          {items.length} {items.length === 1 ? "set" : "sets"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Set tile grid, nested inside the era panel */}
                  <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 sm:p-6 md:grid-cols-4 lg:grid-cols-5">
                    {items.map((set) => (
                      <Link
                        key={set.code}
                        href={`/sets/${set.code}`}
                        className="group flex flex-col items-center rounded-[10px] border border-vault-border bg-vault-raised p-4 text-center transition-colors hover:border-vault-borderStrong"
                      >
                        <SetLogo name={set.name} code={set.code} />

                        <h3 className="mt-3 line-clamp-2 font-vault text-[13px] font-semibold text-vault-text transition-colors group-hover:text-vault-accent">
                          {set.name}
                        </h3>
                        <p className="mt-1 text-[11px] text-vault-textTertiary">
                          {set.code?.toUpperCase()}
                          {set.totalCards != null ? ` · ${set.totalCards} cards` : ""}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.8 18.1a7.3 7.3 0 1 1 0-14.6 7.3 7.3 0 0 1 0 14.6z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.2 16.2 21 21"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
    devWarn("Unable to pre-load fallback totals:", err);
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
        devWarn(`Failed to parse cache set '${code}':`, err);
      }
    }
  } catch (err) {
    devWarn("Unable to read backend cache sets:", err);
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
        devWarn(`Failed to parse legacy set '${file}':`, err);
      }
    }
  } catch (err) {
    devWarn("Unable to read legacy sets from /public/data:", err);
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
  const fs = (await import("fs")).default || (await import("fs"));
  const publicDir = path.join(process.cwd(), "public");
  const eraBanners = loadEraBannerMap(fs, publicDir);

  try {
    const sets = await loadSetsFromBackend();
    if (sets.length) {
      return { props: { sets, eraBanners } };
    }
    devWarn("GraphQL returned no sets; falling back to local data files.");
  } catch (err) {
    devWarn("Unable to load sets from GraphQL, falling back to local data files:", err);
  }

  const fallbackSets = await loadSetsFromFiles();
  return { props: { sets: fallbackSets, eraBanners } };
}
