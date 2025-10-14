"use client";

import React, { useMemo, useContext, useState } from "react";
import Image from "next/image";
import { getSetLogo } from "@/utils/setLogos";
import { AuthContext } from "@/components/Auth/AuthProvider";
import AuthModal from "@/components/Auth/AuthModal"; // <-- default import

export default function SetChecklistHeader({
  name,
  code,
  logoUrl,
  totalCards,
  completedCount = 0,

  // basic search/sort
  filter,
  setFilter,
  sort,
  setSort,

  // advanced rarity (FUNCTIONAL)
  cards = [],
  rarityOptions,
  selectedRarities = new Set(),
  onToggleRarity = () => {},
  onClearRarities = () => {},
  advancedOpen = false,
  setAdvancedOpen = () => {},

  // owned UI (non-functional)
  showOwnedOnly = false,
  hideOwned = false,
  setShowOwnedOnly = () => {},
  setHideOwned = () => {},

  // pricing
  totalSetPriceGbp = null,

  cta = null,
}) {
  const { user, loading } = useContext(AuthContext);
  const isAuthed = Boolean(user);

  const pct = totalCards ? Math.round((completedCount / totalCards) * 100) : 0;
  const derivedLogo = logoUrl || getSetLogo(name, code);

  const totalGBPStr = useMemo(() => {
    if (typeof totalSetPriceGbp !== "number" ) return null;
      try {
        return new Intl.NumberFormat("en-GB", {
          style: "currency", 
          currency: "GBP",
          maximumFractionDigits: 2,
        }).format(totalSetPriceGbp);
      } catch {
        return `£${totalSetPriceGbp.toFixed(2)}`;
      }
  }, [totalSetPriceGbp]);

  const computedRarities = useMemo(() => {
    if (Array.isArray(rarityOptions) && rarityOptions.length) return rarityOptions;

    const getNum = (c) => {
      const m = String(c?.number ?? "").match(/\d+/);
      return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
    };

    const seen = new Set();
    const ordered = [];
    const inOrder = Array.isArray(cards) ? [...cards].sort((a, b) => getNum(a) - getNum(b)) : [];

    for (const c of inOrder) {
      const r = (c?.rarity || "").trim();
      if (!r) continue;
      if (!seen.has(r)) {
        seen.add(r);
        ordered.push(r);
      }
    }
    return ordered;
  }, [cards, rarityOptions]);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode ] = useState("login"); // "login" or "register"

  return (
    <>
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow border border-light-border dark:border-dark-border p-5 md:p-6 mb-6">
        {/* Top row: logo + titles + CTA */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative h-12 w-12 rounded-xl bg-light-alt dark:bg-dark-alt overflow-hidden shrink-0">
              {derivedLogo ? (
                <Image
                  src={derivedLogo}
                  alt={`${name || code?.toUpperCase() || "Set"} logo`}
                  fill
                  sizes="48px"
                  className="object-contain object-center"
                  priority={false}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm font-semibold text-light-textMuted dark:text-dark-textMuted">
                  {code?.toUpperCase() || "SET"}
                </div>
              )}
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {name || code?.toUpperCase()}
              </h1>
              <p className="text-sm text-light-textMuted dark:text-dark-textMuted mt-0.5">
                Code: <span className="font-semibold">{code?.toUpperCase()}</span>
                <span className="mx-1.5">|</span>
                Cards: {totalCards != null ? totalCards : "TBA"}
                {/* {totalGBPStr && (
                  <>
                    <span className="mx-1.5">|</span>
                    <span className="font-semibold text-light-text dark:text-dark-text">
                      Set total: {totalGBPStr}
                    </span>
                  </>
                )} */}
              </p>
            </div>
          </div>

          {cta ? (
            <div className="[&_a]:rounded-xl [&_a]:px-4 [&_a]:py-3 [&_a]:font-semibold [&_a]:text-light-surface dark:[&_a]:text-dark-surface [&_a]:bg-light-accent dark:[&_a]:bg-dark-accent hover:[&_a]:bg-light-accentLight dark:hover:[&_a]:bg-dark-accentLight transition">
              {cta}
            </div>
          ) : null}
        </div>

        {/* Completion OR Auth CTA */}
        <div className="mt-5">
          {loading ? (
            <div className="flex flex-col gap-2">
              <div className="h-4 w-40 rounded bg-light-alt dark:bg-dark-alt animate-pulse" />
              <div className="h-2 w-full rounded-full bg-light-alt dark:bg-dark-alt overflow-hidden">
                <div className="h-2 w-1/3 rounded-full bg-light-border dark:bg-dark-border animate-pulse" />
              </div>
            </div>
          ) : isAuthed ? (
            <>
              <div className="flex items-center justify-between text-sm text-light-textMuted dark:text-dark-textMuted">
                <span>
                  Completion:{" "}
                  <span className="font-semibold text-light-text dark:text-dark-text">
                    {completedCount}/{totalCards ?? "—"}
                  </span>
                </span>
                <span className="font-semibold text-light-text dark:text-dark-text">{pct}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-light-alt dark:bg-dark-alt overflow-hidden">
                <div
                  className="h-2 rounded-full bg-light-accent dark:bg-dark-accent transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          ) : (
            <div
              className="
                flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3
                rounded-xl border border-light-border dark:border-dark-border
                bg-light-alt/60 dark:bg-dark-alt/60 p-3
              "
            >
              <p className="text-sm text-light-text dark:text-dark-text">
                <span className="font-semibold">Track your collection</span> — sign in to mark cards
                as owned and see your completion.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setAuthMode("login"); setAuthModalOpen(true); }} 
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-light-border dark:border-dark-border hover:border-light-accent dark:hover:border-dark-accent bg-light-surface dark:bg-dark-surface"
                >
                  Log in
                </button>
                <button
                  onClick={() => { setAuthMode("register"); setAuthModalOpen(true); }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight"
                >
                  Create account
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Basic controls */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search cards by name or number…"
            className="w-full border rounded-xl px-4 py-3 text-base bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder-light-textMuted dark:placeholder-dark-textMuted focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
            aria-label="Search cards"
          />

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-base bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
            aria-label="Sort cards"
          >
            <option value="owned-first">Owned first</option>
            <option value="number-asc">Card No. ↑</option>
            <option value="number-desc">Card No. ↓</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="rarity-asc">Rarity A–Z</option>
            <option value="rarity-desc">Rarity Z–A</option>
          </select>
        </div>

        {/* Advanced toggle */}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="inline-flex items-center gap-1 text-sm font-medium text-light-textMuted dark:text-dark-textMuted hover:text-light-text dark:hover:text-dark-text transition"
            aria-expanded={advancedOpen ? "true" : "false"}
            aria-controls="advanced-filters-panel"
          >
            Advanced filters
            <svg
              className={["h-4 w-4 transition-transform", advancedOpen ? "rotate-180" : "rotate-0"].join(" ")}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.17l3.71-2.94a.75.75 0 1 1 1.04 1.08l-4.24 3.36a.75.75 0 0 1-.94 0L5.21 8.31a.75.75 0 0 1 .02-1.1z" />
            </svg>
          </button>
        </div>

        {/* Slide-down advanced panel */}
        <div
          id="advanced-filters-panel"
          className={[
            "overflow-hidden transition-all duration-300",
            advancedOpen ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
        >
          <div
            className={[
              "mt-4 rounded-xl border border-light-border dark:border-dark-border",
              "bg-light-alt/60 dark:bg-dark-alt/60 p-4 shadow-inner",
              advancedOpen ? "translate-y-0" : "-translate-y-1",
              "transition-transform duration-300",
            ].join(" ")}
          >
            {/* Rarity chips (FUNCTIONAL via props) */}
            <div>
              <p className="text-sm font-semibold mb-2">Filter by rarity</p>
              <div className="flex flex-wrap gap-2">
                {computedRarities.length === 0 ? (
                  <span className="text-sm text-light-textMuted dark:text-dark-textMuted">
                    No rarity data
                  </span>
                ) : (
                  computedRarities.map((r) => {
                    const active = selectedRarities.has(r);
                    return (
                      <button
                        key={r}
                        onClick={() => onToggleRarity(r)}
                        className={[
                          "px-3 py-1.5 rounded-xl text-sm border transition",
                          active
                            ? "bg-light-accent dark:bg-dark-accent text-light-surface dark:text-dark-surface border-transparent"
                            : "bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border hover:border-light-accent dark:hover:border-dark-accent",
                        ].join(" ")}
                        title={r}
                      >
                        {r}
                      </button>
                    );
                  })
                )}
                {selectedRarities.size > 0 && (
                  <button
                    onClick={onClearRarities}
                    className="px-3 py-1.5 rounded-xl text-sm border transition bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border hover:border-light-accent dark:hover:border-dark-accent"
                    title="Clear rarity filter"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Owned toggles — UI only */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={showOwnedOnly}
                  onChange={(e) => setShowOwnedOnly(e.target.checked)}
                />
                <span className="text-sm">Show owned only (coming soon)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={hideOwned}
                  onChange={(e) => setHideOwned(e.target.checked)}
                />
                <span className="text-sm">Hide owned (coming soon)</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Keep the modal OUTSIDE any overflow containers */}
      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={() => setAuthModalOpen(false)}
          defaultMode={authMode}
        />
      )}
    </>
  );
}

