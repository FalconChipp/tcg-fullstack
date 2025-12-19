"use client";
import React from "react";

// Live features (copy tweaked so pricing isn’t promised twice)
const features = [
  {
    icon: "🗃️",
    title: "Digital Collection Manager",
    desc: "Track what you own across sets, keep duplicates organised, and see your collection at a glance.",
  },
  {
    icon: "📒",
    title: "Digital Binders",
    desc: "Recreate your real binders online with layouts, covers, and shareable links for your favourite sets.",
  },
  {
    icon: "🔎",
    title: "Advanced Search",
    desc: "Find any English card by name, set code, or number — instantly, on web and mobile.",
  },
  {
    icon: "⭐",
    title: "Wishlist & wantlist",
    desc: "Keep your chase cards front and centre so you never forget what you’re hunting next.",
  },
];

// Coming soon (roadmap-style)
const comingSoon = [
  {
    icon: "🏷️",
    title: "Marketplace",
    desc: "Buy and sell with UK-focused tools, clear fees, and support for both cards and products.",
    status: "In development",
  },
  {
    icon: "🔄",
    title: "Trading",
    desc: "Secure trades with tracked shipping and privacy-first profiles for both sides.",
    status: "In planning",
  },
  {
    icon: "📈",
    title: "Price tracking",
    desc: "See collection value, trends, and historical movement powered by real pricing data.",
    status: "In testing",
  },
  {
    icon: "🔔",
    title: "Price alerts",
    desc: "Get notified when cards move, spike, or hit your personal targets.",
    status: "In Testing",
  },
  {
    icon: "🏆",
    title: "Achievements",
    desc: "Unlock badges as you complete sets, hit milestones, and grow your collection.",
    status: "Planned",
  },
];

export default function KeyFeatures() {
  return (
    <section className="py-16 px-4 bg-light-background dark:bg-dark-background transition-colors">
      <div className="max-w-6xl mx-auto">
        {/* Section heading */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-light-text dark:text-dark-text drop-shadow">
            Features & roadmap
          </h2>
          <p className="mt-3 text-base md:text-lg text-light-textSecondary dark:text-dark-textSecondary max-w-2xl mx-auto">
            SixByFive already gives you powerful tools for managing your
            Pokémon collection, with more on the way to help you buy, sell,
            and trade safely.
          </p>
        </div>

        {/* Available now */}
        <div className="mb-12">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted">
              Available now
            </h3>
            <span className="inline-flex items-center rounded-full border border-light-border dark:border-dark-border px-3 py-1 text-xs text-light-textSecondary dark:text-dark-textSecondary bg-light-surfaceAlt dark:bg-dark-surfaceAlt">
              🟢 Live features you can use today
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="
                  flex flex-col items-start
                  bg-light-surface dark:bg-dark-surface
                  rounded-2xl p-6
                  shadow-sm hover:shadow-md hover:-translate-y-0.5
                  transition-transform
                  border border-light-border dark:border-dark-border
                "
              >
                <div
                  className="flex items-center justify-center h-10 w-10 rounded-full bg-light-accent/10 dark:bg-dark-accent/20 mb-3"
                  aria-hidden="true"
                >
                  <span className="text-xl">{f.icon}</span>
                </div>
                <div className="font-semibold text-base md:text-lg text-light-accent dark:text-dark-accent mb-1">
                  {f.title}
                </div>
                <div className="text-sm md:text-[15px] text-light-textSecondary dark:text-dark-textSecondary">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Roadmap / Coming soon */}
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted">
              On the way
            </h3>
            <span className="inline-flex items-center rounded-full border border-light-border dark:border-dark-border px-3 py-1 text-xs text-light-textSecondary dark:text-dark-textSecondary bg-light-alt dark:bg-dark-alt">
              🚧 Actively being designed & built
            </span>
          </div>

          <div className="space-y-3">
            {comingSoon.map((f, i) => (
              <div
                key={i}
                className="
                  flex items-start gap-3
                  rounded-2xl px-4 py-3
                  bg-light-alt dark:bg-dark-alt
                  border border-dashed border-light-border/80 dark:border-dark-border/80
                "
              >
                <div
                  className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-light-surface dark:bg-dark-surface"
                  aria-hidden="true"
                >
                  <span className="text-xl">{f.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-sm md:text-base text-light-text dark:text-dark-text">
                      {f.title}
                    </div>
                    <span className="inline-flex items-center rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted">
                      {f.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs md:text-sm text-light-textSecondary dark:text-dark-textSecondary">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
