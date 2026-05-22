// src/components/Layout/FAQ.js
"use client";

import React, { useState, useRef, useEffect } from "react";

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
    q: "When will trading and the marketplace go live?",
    a: `They are being tested with early users. Join Discord to follow updates and get access when testing opens: ${DISCORD_INVITE}`,
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

function Collapsible({ id, isOpen, children }) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!innerRef.current) return;

    setHeight(innerRef.current.scrollHeight);
  }, [isOpen, children]);

  return (
    <div
      id={id}
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen ? "opacity-100" : "opacity-0"
      }`}
      style={{ maxHeight: isOpen ? height : 0 }}
      aria-hidden={!isOpen}
    >
      <div
        ref={innerRef}
        className="px-5 pb-5 pt-0 text-sm leading-6 text-dark-textMuted"
      >
        {children}
      </div>
    </div>
  );
}

function FAQItem({ item, index, isOpen, onToggle }) {
  const bodyId = `faq-body-${index}`;

  return (
    <div
      className={[
        "rounded-2xl border transition",
        isOpen
          ? "border-dark-accent/70 bg-dark-surface shadow-xl shadow-black/20"
          : "border-dark-border bg-dark-surface hover:border-dark-accent/50",
      ].join(" ")}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-dark-accent"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={bodyId}
      >
        <div className="flex items-center gap-3">
          <span
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black",
              isOpen
                ? "bg-dark-accent text-white"
                : "bg-dark-alt text-dark-textMuted",
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
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-lg font-black transition",
            isOpen
              ? "border-dark-accent bg-dark-accent/15 text-dark-accentLight"
              : "border-dark-border bg-dark-alt text-dark-textMuted",
          ].join(" ")}
          aria-hidden="true"
        >
          {isOpen ? "−" : "+"}
        </span>
      </button>

      <Collapsible id={bodyId} isOpen={isOpen}>
        {item.a}
      </Collapsible>
    </div>
  );
}

export default function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section className="relative overflow-hidden bg-dark-background px-5 py-20 sm:px-7">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-[-180px] top-20 h-[420px] w-[420px] rounded-full bg-dark-accent/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="mb-4 inline-flex rounded-full border border-dark-border bg-dark-surface px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-dark-textMuted">
            FAQ
          </div>

          <h2 className="text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
            Questions?
          </h2>

          <p className="mt-4 max-w-xl text-base leading-7 text-dark-textMuted">
            SixByFive TCG is in active development. These are the questions that
            come up most often from collectors trying the platform.
          </p>

          <div className="mt-8 rounded-3xl border border-dark-border bg-dark-surface p-5">
            <h3 className="text-base font-black text-dark-strong">
              Still need help?
            </h3>

            <p className="mt-2 text-sm leading-6 text-dark-textMuted">
              Join Discord for support, roadmap updates, feature testing, and
              direct feedback.
            </p>

            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-dark-accent px-5 text-sm font-black text-white transition hover:bg-dark-accentLight"
            >
              Join Discord
            </a>
          </div>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = open === index;

            return (
              <FAQItem
                key={item.q}
                item={item}
                index={index}
                isOpen={isOpen}
                onToggle={() => setOpen(isOpen ? null : index)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}