// src/components/Home/ProductPillars.js
"use client";

import React from "react";

const pillars = [
  {
    label: "Search",
    title: "Find the exact card faster",
    description:
      "Search by card name, set, number, or expansion so you can quickly find the version you actually mean.",
    meta: "Name · Set · Number",
  },
  {
    label: "Collection",
    title: "Track what you own",
    description:
      "Add cards to your collection, keep quantities organised, and build a clearer picture of what you already have.",
    meta: "Owned · Quantity · Value",
  },
  {
    label: "Binders",
    title: "Build around real collecting goals",
    description:
      "Create digital binders for master sets, themes, trades, wishlists, or the same layouts you use physically.",
    meta: "Sets · Pages · Progress",
  },
  {
    label: "Wishlist",
    title: "Keep chase cards visible",
    description:
      "Track the cards you still want, plan future pickups, and keep your next collecting goals in one place.",
    meta: "Chase cards · Missing cards",
  },
];

function PillarCard({ pillar, index }) {
  return (
    <article className="group rounded-3xl border border-dark-border bg-dark-surface p-6 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-dark-accent/70 hover:shadow-2xl hover:shadow-black/20">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-dark-accent/15 text-sm font-black text-dark-accentLight">
          {String(index + 1).padStart(2, "0")}
        </div>

        <span className="rounded-full border border-dark-border bg-dark-alt px-3 py-1 text-xs font-bold text-dark-textMuted">
          {pillar.label}
        </span>
      </div>

      <h3 className="text-xl font-black tracking-tight text-dark-strong">
        {pillar.title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-dark-textMuted">
        {pillar.description}
      </p>

      <div className="mt-5 rounded-2xl border border-dark-border bg-dark-alt px-4 py-3 text-xs font-bold text-dark-textMuted">
        {pillar.meta}
      </div>
    </article>
  );
}

export default function ProductPillars() {
  return (
    <section className="relative overflow-hidden bg-dark-background px-5 py-20 sm:px-7">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-160px] top-20 h-[360px] w-[360px] rounded-full bg-dark-accent/10 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[420px] w-[420px] rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10 max-w-3xl">
          <div className="mb-4 inline-flex rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-dark-textMuted">
            Core tools
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
          {pillars.map((pillar, index) => (
            <PillarCard key={pillar.title} pillar={pillar} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}