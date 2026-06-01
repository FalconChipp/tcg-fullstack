"use client";

import React from "react";

const pillars = [
  {
    label: "Search",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
    title: "Find the exact card you mean",
    description:
      "Search by name, set, number, or expansion. Narrow down to the exact printing instantly — whether it's a 1st edition base set or last month's special art rare.",
  },
  {
    label: "Collection",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
    title: "Track everything you own",
    description:
      "Log cards with conditions, quantities, and variants. Your collection stays organised and valued in one place — no more spreadsheets or guesswork.",
  },
  {
    label: "Binders",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    title: "Build around real goals",
    description:
      "Create digital binders for master sets, theme builds, or trade stock. See your progress at a glance and share them with other collectors.",
  },
  {
    label: "Wishlist",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    title: "Keep chase cards in sight",
    description:
      "Add cards you're hunting to your wishlist. Know exactly what you still need, plan your next pickup, and never lose track of a target card.",
  },
];

function PillarCard({ pillar }) {
  return (
    <article className="group rounded-3xl border border-dark-border bg-dark-surface p-6 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-dark-accent/70 hover:shadow-2xl hover:shadow-black/20">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-dark-accent/15 text-dark-accentLight">
          {pillar.icon}
        </div>
        <span className="text-sm font-black text-dark-strong">{pillar.label}</span>
      </div>

      <h3 className="text-lg font-black tracking-tight text-dark-strong leading-snug">
        {pillar.title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-dark-textMuted">
        {pillar.description}
      </p>
    </article>
  );
}

export default function ProductPillars() {
  return (
    <section className="relative overflow-hidden bg-dark-background px-5 py-14 sm:px-7 lg:py-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-160px] top-20 h-[360px] w-[360px] rounded-full bg-dark-accent/10 blur-3xl" />
        <div className="absolute right-[-140px] top-[170px] h-[420px] w-[420px] rounded-full bg-purple-500/[0.07] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[260px] w-[420px] bg-gradient-to-t from-dark-background via-dark-background/70 to-transparent" />
        <div className="absolute bottom-0 left-0 h-28 w-full bg-gradient-to-b from-transparent to-dark-background" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <div className="mb-4 inline-flex rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-dark-textMuted">
            Explore the platform
          </div>

          <h2 className="text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
            Built around how collectors actually collect.
          </h2>

          <p className="mt-4 text-base leading-7 text-dark-textMuted">
            SixByFive TCG connects the parts of collecting that usually live in
            separate places: search, collection tracking, binders, wishlist, and
            marketplace discovery.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {pillars.map((pillar) => (
            <PillarCard key={pillar.label} pillar={pillar} />
          ))}
        </div>
      </div>
    </section>
  );
}
