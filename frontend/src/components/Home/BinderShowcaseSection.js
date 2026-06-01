// src/components/Home/BinderShowcaseSection.js
"use client";

import React from "react";
import Image from "next/image";
import {
  FaCheckCircle,
  FaLayerGroup,
  FaRegSquare,
  FaStar,
} from "react-icons/fa";

const binderTypes = [
  "Match your physical binder layout",
  "Plan missing slots page-by-page",
  "Track owned cards and upgrades",
  "Build master sets, trades, and themes",
  "Share binders without spreadsheets",
];

const previewSlots = [
  {
    number: "001",
    name: "Bulbasaur",
    status: "owned",
    image: "https://assets.tcgdex.net/en/sv/sv03.5/001/high.webp",
  },
  {
    number: "002",
    name: "Ivysaur",
    status: "owned",
    image: "https://assets.tcgdex.net/en/sv/sv03.5/002/high.webp",
  },
  {
    number: "003",
    name: "Venusaur ex",
    status: "upgrade",
    image: "https://assets.tcgdex.net/en/sv/sv03.5/003/high.webp",
  },
  {
    number: "004",
    name: "Charmander",
    status: "owned",
    image: "https://assets.tcgdex.net/en/sv/sv03.5/004/high.webp",
  },
  {
    number: "005",
    name: "Charmeleon",
    status: "not owned",
    image: "https://assets.tcgdex.net/en/sv/sv03.5/005/high.webp",
  },
  {
    number: "006",
    name: "Charizard ex",
    status: "not owned",
    image: "https://assets.tcgdex.net/en/sv/sv03.5/006/high.webp",
  },
  {
    number: "007",
    name: "Squirtle",
    status: "owned",
    image: "https://assets.tcgdex.net/en/sv/sv03.5/007/high.webp",
  },
  {
    number: "008",
    name: "Wartortle",
    status: "owned",
    image: "https://assets.tcgdex.net/en/sv/sv03.5/008/high.webp",
  },
  {
    number: "009",
    name: "Blastoise ex",
    status: "owned",
    image: "https://assets.tcgdex.net/en/sv/sv03.5/009/high.webp",
  },
];

function BinderFeaturePill({ children }) {
  return (
    <div className="rounded-2xl border border-dark-border bg-dark-surface px-4 py-3 text-sm font-bold text-dark-text">
      {children}
    </div>
  );
}

function BinderPocket({ slot }) {
  const isMissing = slot.status === "not owned";
  const isUpgrade = slot.status === "upgrade";

  return (
    <div
      className={[
        "relative aspect-[2.5/3.5] overflow-hidden rounded-xl border bg-dark-alt shadow-sm transition",
        "group-hover:border-dark-accent/40",
        isMissing ? "border-dashed border-dark-border" : "border-dark-border",
        isUpgrade ? "ring-1 ring-amber-300/45" : "",
      ].join(" ")}
    >
      {slot.image && (
        <Image
          src={slot.image}
          alt={`${slot.name} card preview`}
          fill
          sizes="(max-width: 640px) 28vw, (max-width: 1024px) 18vw, 120px"
          className={[
            "object-cover",
            isMissing ? "opacity-20 grayscale" : "",
          ].join(" ")}
        />
      )}

      <div
        className={[
          "absolute inset-0",
          isMissing
            ? "bg-dark-background/65"
            : "bg-gradient-to-b from-black/5 via-transparent to-black/35",
        ].join(" ")}
      />

      <div className="absolute left-2 top-2 rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] font-black text-white/90 backdrop-blur-sm">
        #{slot.number}
      </div>

      {isUpgrade && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-300 text-[9px] text-amber-950 shadow-sm">
          <FaStar />
        </div>
      )}

      {isMissing ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-2 text-center text-dark-textMuted">
          <FaRegSquare className="text-base opacity-60" />

          <div>
            <p className="text-[9px] font-black uppercase tracking-wide">
              Missing
            </p>
            <p className="mt-1 line-clamp-2 text-[9px] font-bold opacity-70">
              {slot.name}
            </p>
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-2 bottom-2 rounded-lg border border-white/10 bg-black/45 px-2 py-1.5 backdrop-blur-sm">
          <p className="truncate text-[10px] font-black text-white">
            {slot.name}
          </p>
          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-white/60">
            {isUpgrade ? "Upgrade target" : "Owned"}
          </p>
        </div>
      )}
    </div>
  );
}

function BinderPagePreview() {
  return (
    <div className="mx-auto w-full max-w-[470px]">
      <div className="rounded-[2rem] border border-dark-border bg-dark-surface p-4 shadow-2xl shadow-black/25">
        <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-dark-border bg-dark-alt/70 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dark-accent/15 text-dark-accentLight">
              <FaLayerGroup />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-dark-textMuted">
                Binder page preview
              </p>
              <p className="mt-0.5 truncate text-sm font-black text-dark-strong">
                Scarlet & Violet 151 · Page 1
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-1.5 rounded-full border border-dark-accent/35 bg-dark-accent/10 px-3 py-1 text-xs font-black text-dark-accentLight sm:inline-flex">
            <FaCheckCircle className="text-[10px]" />
            7 / 9
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-dark-border bg-dark-background/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wide text-dark-textMuted">
              9-pocket layout
            </p>

            <div className="flex gap-1.5">
              {[1, 2, 3].map((page) => (
                <span
                  key={page}
                  className={[
                    "h-2 w-6 rounded-full",
                    page === 1 ? "bg-dark-accent" : "bg-dark-border",
                  ].join(" ")}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {previewSlots.map((slot) => (
              <BinderPocket key={slot.number} slot={slot} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-dark-border bg-dark-alt px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wide text-dark-textMuted">
              Owned
            </p>
            <p className="mt-0.5 text-sm font-black text-dark-strong">7</p>
          </div>

          <div className="rounded-xl border border-dark-border bg-dark-alt px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wide text-dark-textMuted">
              Missing
            </p>
            <p className="mt-0.5 text-sm font-black text-dark-strong">2</p>
          </div>

          <div className="rounded-xl border border-dark-border bg-dark-alt px-3 py-2">
            <p className="text-[9px] font-black uppercase tracking-wide text-dark-textMuted">
              Upgrade
            </p>
            <p className="mt-0.5 text-sm font-black text-dark-strong">1</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BinderShowcaseSection() {
  return (
    <section className="bg-dark-background px-5 py-14 sm:px-7 lg:py-20">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <div className="mb-4 inline-flex rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-dark-textMuted">
            Binder-first collecting
          </div>

          <h2 className="text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
            Build digital binders that match your real collection.
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-7 text-dark-textMuted">
            Plan your collection the same way you organise it physically. Create
            binder pages, fill slots from your collection, mark missing cards,
            and track upgrades without losing the feel of a real binder.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {binderTypes.map((item) => (
              <BinderFeaturePill key={item}>{item}</BinderFeaturePill>
            ))}
          </div>
        </div>

        <BinderPagePreview />
      </div>
    </section>
  );
}