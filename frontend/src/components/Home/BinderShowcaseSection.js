// src/components/Home/BinderShowcaseSection.js
"use client";

import React from "react";

const binderTypes = [
  "Master set binder",
  "Trade binder",
  "Wishlist binder",
  "Theme binder",
  "Physical binder planning",
];

function BinderSlot({ filled = false, highlight = false }) {
  return (
    <div
      className={[
        "aspect-[2/3] rounded-xl border transition",
        highlight
          ? "border-dark-accent bg-gradient-to-br from-dark-accent/40 via-purple-500/20 to-dark-alt"
          : filled
          ? "border-dark-accent/30 bg-dark-accent/15"
          : "border-dark-border bg-dark-alt",
      ].join(" ")}
    >
      <div className="h-full rounded-xl bg-gradient-to-b from-white/5 to-transparent" />
    </div>
  );
}

function BinderPreview() {
  const slots = [
    { filled: true, highlight: true },
    { filled: true },
    { filled: true },
    { filled: true },
    { filled: false },
    { filled: true },
    { filled: false },
    { filled: true },
    { filled: false },
  ];

  return (
    <div className="rounded-[2rem] border border-dark-border bg-dark-surface p-5 shadow-2xl shadow-black/30">
      <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-dark-border bg-dark-alt px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-dark-textMuted">
            Binder preview
          </p>
          <p className="mt-1 text-sm font-black text-dark-strong">
            Scarlet & Violet 151
          </p>
        </div>

        <span className="rounded-full bg-dark-accent/15 px-3 py-1 text-xs font-black text-dark-accentLight">
          72%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {slots.map((slot, index) => (
          <BinderSlot
            key={index}
            filled={slot.filled}
            highlight={slot.highlight}
          />
        ))}
      </div>

      <div className="mt-5 h-2 rounded-full bg-dark-border">
        <div className="h-2 w-[72%] rounded-full bg-dark-accent" />
      </div>

      <p className="mt-3 text-sm text-dark-textMuted">
        Track what is complete, what is missing, and what still needs upgrading.
      </p>
    </div>
  );
}

export default function BinderShowcaseSection() {
  return (
    <section className="bg-dark-background px-5 py-20 sm:px-7">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <div className="mb-4 inline-flex rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-dark-textMuted">
            Binder-first collecting
          </div>

          <h2 className="text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
            Build digital binders that match your real collection.
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-7 text-dark-textMuted">
            Binders are one of the most natural ways collectors organise cards.
            SixByFive TCG keeps that feeling, but adds progress tracking,
            wishlist planning, and easy sharing.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {binderTypes.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-dark-border bg-dark-surface px-4 py-3 text-sm font-bold text-dark-text"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <BinderPreview />
      </div>
    </section>
  );
}