// src/pages/sets/index.js
// CHANGED: Era ordering now prioritizes newest first (SV → … → WotC → misc).
// CHANGED: Within an era, sets are ordered by releaseDate ASC (oldest → newest).
//          If no dates, falls back to name A–Z. Era is still read directly from JSON.
//          Kept polished SetLogo, local search, and your Layout/SEO.

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Layout from "@/components/Layout/Layout";
import { getSetLogo } from "@/utils/setLogos";
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
  misc: "Special / Misc",
};

/* ---------------- Era priority: newest → oldest (sv first), misc last ------- */
/** CHANGED: explicit era ordering so "newest era first" is guaranteed. */
const ERA_ORDER = [
  "sv",     // Scarlet & Violet (newest)
  "swsh",   // Sword & Shield
  "sm",     // Sun & Moon
  "xy",
  "bw",
  "hgss",
  "dp",
  "ex",
  "ecard",
  "wotc",   // oldest mainline era
  "misc",   // always last
];

// Ranking function for eras (unknown keys get placed before 'misc', after known modern lines)
function eraRank(key) {
  const k = (key || "misc").toLowerCase();
  const idx = ERA_ORDER.indexOf(k);
  if (idx !== -1) return idx;
  // Unknown eras: position just before 'misc' but after all known ones
  return ERA_ORDER.length - 1; // effectively next to misc
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
        alt={`${name || code?.toUpperCase()} logo`}
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
  // Normalize era to a known key or "misc" (no guessing).
  const enhanced = useMemo(
    () =>
      sets.map((s) => {
        const raw = (s.era || "").trim().toLowerCase();
        const era = ERA_LABELS[raw] ? raw : "misc";
        return { ...s, era };
      }),
    [sets]
  );

  // Local search + era filter
  const [query, setQuery] = useState("");
  const [eraFilter, setEraFilter] = useState("all");

  // Which eras exist in the data (ordered by our eraRank; 'misc' last)
  // CHANGED: was alphabetical; now uses eraRank so SV shows first.
  const erasInData = useMemo(() => {
    const present = Array.from(new Set(enhanced.map((s) => s.era || "misc")));
    return present.sort((a, b) => eraRank(a) - eraRank(b));
  }, [enhanced]);

  // Filter + group strictly by JSON-provided era
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byEra = new Map();

    for (const s of enhanced) {
      if (eraFilter !== "all" && s.era !== eraFilter) continue;

      if (q) {
        const name = (s.name || "").toLowerCase();
        const code = (s.code || "").toLowerCase();
        if (!name.includes(q) && !code.includes(q)) continue;
      }

      const key = s.era || "misc";
      if (!byEra.has(key)) byEra.set(key, []);
      byEra.get(key).push(s);
    }

    // Order within an era by release date ASC (oldest → newest).
    // If both have dates, compare ascending; otherwise fall back to name A–Z.
    for (const arr of byEra.values()) {
      arr.sort((a, b) => {
        const da = a.releaseDate ? String(a.releaseDate) : "";
        const db = b.releaseDate ? String(b.releaseDate) : "";
        if (da && db) {
          // ascending
          return da.localeCompare(db);
        }
        if (da || db) {
          // items with a date come first
          return db ? 1 : -1;
        }
        return (a.name || "").localeCompare(b.name || "");
      });
    }
    // Order within an era by release date DESC (newest → oldest).
    // for (const arr of byEra.values()) {
    // arr.sort((a, b) => {
    //     const da = a.releaseDate ? String(a.releaseDate) : "";
    //     const db = b.releaseDate ? String(b.releaseDate) : "";

    //     if (da && db) {
    //     // descending
    //     return db.localeCompare(da);
    //     }
    //     if (da || db) {
    //     // items with a date come first
    //     return db ? -1 : 1;
    //     }
    //     return (a.name || "").localeCompare(b.name || "");
    // });
    // }

    // Return sections ordered by eraRank so newest era section is first.
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

        {/* Grouped sections (strictly by JSON-provided era) */}
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
                        {set.releaseDate
                          ? new Date(set.releaseDate).toLocaleDateString()
                          : "TBA"}
                      </p>
                      {set.totalCards ? (
                        <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-1">
                          {set.totalCards} cards
                        </p>
                      ) : null}
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

export async function getStaticProps() {
  const fs = (await import("fs")).default || (await import("fs"));
  const DATA_DIR = path.join(process.cwd(), "public", "data");
  let sets = [];

  try {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    sets = files.map((file) => {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
      const json = JSON.parse(raw);
      return {
        code: json.code || file.replace(/\.json$/i, ""),
        name: json.name || json.code?.toUpperCase() || file,
        releaseDate: json.releaseDate || null,
        totalCards: json.totalCards || (Array.isArray(json.cards) ? json.cards.length : null),
        era: json.era || null, // read directly; normalized above
      };
    });
  } catch (err) {
    console.error("Error reading sets from /public/data:", err);
  }

  // Build-time ordering is irrelevant to the final grouping order,
  // but we keep a deterministic sort here anyway (by code).
  sets.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  return { props: { sets } };
}
