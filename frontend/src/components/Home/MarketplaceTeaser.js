// src/components/Home/MarketplaceTeaser.js
"use client";

import React from "react";
import Link from "next/link";

const listingTypes = [
  "Recently listed",
  "Wishlist matches",
  "Trade available",
  "Offers accepted",
];

const demoListings = [
  {
    name: "Charizard ex",
    set: "Obsidian Flames #223",
    price: "£89.99",
    badge: "NM",
    image: "https://images.pokemontcg.io/sv3/223_hires.png",
  },
  {
    name: "Pikachu",
    set: "Scarlet & Violet 151 #25",
    price: "£12.50",
    badge: "Trade",
    image: "https://images.pokemontcg.io/sv3pt5/25_hires.png",
  },
  {
    name: "Umbreon VMAX",
    set: "Evolving Skies #215",
    price: "£44.00",
    badge: "Offer",
    image: "https://images.pokemontcg.io/swsh7/215_hires.png",
  },
  {
    name: "Mew ex",
    set: "Scarlet & Violet 151 #151",
    price: "£18.75",
    badge: "New",
    image: "https://images.pokemontcg.io/sv3pt5/151_hires.png",
  },
];

function ListingCard({ name, set, price, badge, image }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-dark-border bg-dark-surface p-4 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-dark-accent/70 hover:shadow-2xl hover:shadow-black/20">
      {/* 
        Changed:
        - Removed full-width image background
        - Added a centred card-frame wrapper
        - Background now matches the card image ratio instead of filling the whole card area
      */}
      <div className="mb-4 flex justify-center">
        <div className="relative aspect-[245/342] w-full max-w-[250px] overflow-hidden rounded-2xl border border-dark-border bg-dark-alt shadow-lg shadow-black/20">
          {image ? (
            <img
              src={image}
              alt={`${name} card preview`}
              className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.025]"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-dark-accent/30 via-purple-500/20 to-dark-alt" />
          )}

          <span className="absolute left-3 top-3 rounded-full border border-dark-border bg-dark-background/85 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-dark-textMuted backdrop-blur">
            Demo
          </span>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-dark-strong">
            {name}
          </h3>

          <p className="mt-1 truncate text-sm text-dark-textMuted">{set}</p>
        </div>

        <span className="shrink-0 rounded-full bg-dark-accent/15 px-2.5 py-1 text-xs font-black text-dark-accentLight">
          {badge}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-dark-textMuted">
            Example price
          </p>

          <p className="mt-1 text-xl font-black text-dark-strong">{price}</p>
        </div>

        <span className="rounded-full border border-dark-border bg-dark-alt px-2.5 py-1 text-[11px] font-bold text-dark-textMuted">
          Preview
        </span>
      </div>
    </article>
  );
}

export default function MarketplaceTeaser() {
  return (
    <section className="relative overflow-hidden bg-dark-background px-5 py-20 sm:px-7">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-[-160px] top-10 h-[420px] w-[420px] rounded-full bg-dark-accent/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-dark-textMuted">
              Marketplace
            </div>

            <h2 className="text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
              Find cards from other collectors.
            </h2>

            <p className="mt-4 text-base leading-7 text-dark-textMuted">
              Browse listings, compare conditions, and discover cards that match
              what you are already tracking in your wishlist.
            </p>
          </div>

          <Link
            href="/marketplace"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-dark-accent px-6 text-sm font-black text-white transition hover:bg-dark-accentLight"
          >
            Browse marketplace
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {listingTypes.map((item) => (
            <span
              key={item}
              className="rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold text-dark-textMuted"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {demoListings.map((listing) => (
            <ListingCard key={`${listing.name}-${listing.set}`} {...listing} />
          ))}
        </div>
      </div>
    </section>
  );
}