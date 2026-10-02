"use client";

import React, { useState } from "react";

const DISCORD_INVITE = "https://discord.gg/PRMbMbRE2H";

export const FAQ_ITEMS = [
  {
    q: "Is the site free to use?",
    a: "Yes. Core features are free during the beta, and a free tier will remain available.",
  },
  {
    q: "Who can see my collection and binders?",
    a: "Profiles, binders, and collections are public by default. You can share links easily, and you can remove items any time.",
  },
  {
    q: "Do you track card prices?",
    a: "Yes — prices are refreshed regularly so your collection value stays up to date.",
  },
  {
    q: "How do I add cards to my collection?",
    a: 'Use search to find by set code and number, such as "SVI 210", or by card name. From there, you can add cards to your collection, wishlist, or binder.',
  },
  {
    q: "Can I organise my collection into multiple binders?",
    a: "Yes. You can create digital binders for sets, themes, trade cards, wishlist cards, or physical binder planning.",
  },
  {
    q: "Can I buy, sell, or trade cards on SixByFive?",
    a: "Yes — both the marketplace and collector-to-collector trading are live. List cards for sale, browse other collectors' listings, use the built-in wallet, or propose trades straight from someone's binder or profile.",
  },
  {
    q: "Can I export my collection?",
    a: "Export tools are planned. For now, collections are managed directly inside SixByFive TCG.",
  },
  {
    q: "What card games are supported?",
    a: "Pokémon TCG is supported today. MTG and Disney Lorcana support are planned later.",
  },
  {
    q: "How do I give feedback or suggest new features?",
    a: `Join the Discord or use the contact page. Feedback from collectors directly shapes what gets built next: ${DISCORD_INVITE}`,
  },
];

function FAQItem({ item, index, isOpen, onToggle }) {
  return (
    <div
      className={[
        "rounded-2xl border transition-colors duration-200",
        isOpen
          ? "border-dark-accent/70 bg-dark-surface shadow-xl shadow-black/20"
          : "border-dark-border bg-dark-surface hover:border-dark-accent/50",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-dark-accent"
      >
        <div className="flex items-center gap-3">
          <span
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black",
              isOpen ? "bg-dark-accent text-white" : "bg-dark-alt text-dark-textMuted",
            ].join(" ")}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <span
            className={[
              "text-sm font-black sm:text-base",
              isOpen ? "text-dark-strong" : "text-dark-text",
            ].join(" ")}
          >
            {item.q}
          </span>
        </div>

        <span
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-lg font-black transition-colors duration-200",
            isOpen
              ? "border-dark-accent bg-dark-accent/15 text-dark-accentLight"
              : "border-dark-border bg-dark-alt text-dark-textMuted",
          ].join(" ")}
          aria-hidden="true"
        >
          {isOpen ? "−" : "+"}
        </span>
      </button>

      <div
        aria-hidden={!isOpen}
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          overflow: "hidden",
          transition: "grid-template-rows 280ms ease-in-out, opacity 200ms ease-in-out",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div style={{ minHeight: 0 }}>
          <div className="mx-5 border-t border-dark-border/40" />
          <p className="px-5 py-4 text-sm leading-7 text-dark-textMuted">
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [open, setOpen] = useState(null);

  return (
    <section className="relative overflow-hidden bg-dark-background px-5 py-14 sm:px-7 lg:py-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-10 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-dark-accent/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        {/* Left — heading */}
        <div>
          <div className="mb-4 inline-flex rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-dark-textMuted">
            FAQ
          </div>
          <h2 className="text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
            Questions answered.
          </h2>
          <p className="mt-4 text-base leading-7 text-dark-textMuted">
            Can't find what you're looking for? Come chat in the Discord.
          </p>
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-dark-accent px-5 text-sm font-black text-white transition hover:bg-dark-accentLight"
          >
            Join Discord
          </a>
        </div>

        {/* Right — items */}
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => (
            <FAQItem
              key={item.q}
              item={item}
              index={index}
              isOpen={open === index}
              onToggle={() => setOpen(open === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
