"use client";

import React, { useState, useRef, useEffect } from "react";

// Centralised invite for reuse in copy
const DISCORD_INVITE = "https://discord.gg/PRMbMbRE2H";

const FAQ_ITEMS = [
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
    a: 'Use Advanced Search to find by set code + number (e.g., "SVI 210") or by name, then add to your collection or a binder.',
  },
  {
    q: "Can I organise my collection into multiple binders?",
    a: "Yes — create as many digital binders as you like, each with its own name, cover, and layout.",
  },
  {
    q: "When will trading and the marketplace go live?",
    a: `We’re testing now with early users. Join Discord to get access when it opens: ${DISCORD_INVITE}`,
  },
  {
    q: "Can I export my collection?",
    a: "Export will arrive after trading/marketplace. For now, manage everything directly on the site.",
  },
  {
    q: "What card games are supported?",
    a: "Pokémon TCG today. Support for MTG and Disney Lorcana is planned.",
  },
  {
    q: "How do I give feedback or suggest new features?",
    a: `Join our Discord or use the contact page — we read everything: ${DISCORD_INVITE}`,
  },
];

// Collapsible answer with smooth measured height
function Collapsible({ id, isOpen, children }) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (innerRef.current) {
      const h = innerRef.current.scrollHeight;
      setHeight(h);
    }
  }, [isOpen, children]);

  return (
    <div
      id={id}
      className={`
        overflow-hidden transition-all duration-300 ease-in-out
        ${isOpen ? "opacity-100" : "opacity-0"}
      `}
      style={{ maxHeight: isOpen ? height : 0 }}
      aria-hidden={!isOpen}
    >
      <div
        ref={innerRef}
        className="
          px-6 pt-3 pb-5
          text-sm md:text-[15px]
          text-light-textSecondary dark:text-dark-textSecondary
        "
      >
        {children}
      </div>
    </div>
  );
}

export default function FAQ() {
  const [open, setOpen] = useState(null);

  return (
    <section className="py-16 px-4 bg-light-background dark:bg-dark-background transition-colors">
      <div className="mx-auto max-w-6xl flex flex-col gap-10 md:flex-row">
        {/* Left column: intro + Discord CTA */}
        <div className="md:w-1/3">
          <h2 className="text-3xl md:text-4xl font-bold text-light-text dark:text-dark-text drop-shadow-sm">
            Questions?
          </h2>
          <p className="mt-3 text-sm md:text-base text-light-textSecondary dark:text-dark-textSecondary">
            SixByFive is in active development, and we&apos;re constantly
            improving it with feedback from real collectors. Here are some of
            the most common questions — and if you&apos;re still not sure,
            we&apos;re only a message away.
          </p>

          <div className="mt-5 space-y-2 text-sm text-light-textSecondary dark:text-dark-textSecondary">
            <p>Need help, found a bug, or want to request a feature?</p>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex items-center gap-2 rounded-full
                bg-light-accent text-white
                dark:bg-dark-accent dark:text-white
                px-4 py-2 text-xs font-semibold
                shadow hover:bg-light-accentLight dark:hover:bg-dark-accentLight
                transition
              "
            >
              <span>Join the Discord</span>
              <span aria-hidden="true">↗</span>
            </a>
            <p className="text-[11px] text-light-textMuted dark:text-dark-textMuted">
              Early feature testing, roadmap previews, and direct feedback
              all happen there.
            </p>
          </div>
        </div>

        {/* Right column: accordion list */}
        <div className="md:w-2/3">
          <div className="space-y-4">
            {FAQ_ITEMS.map((f, i) => {
              const isOpen = open === i;
              const bodyId = `faq-body-${i}`;

              return (
                <div
                  key={i}
                  className={`
                    rounded-2xl border transition-all
                    bg-light-surface dark:bg-dark-surface
                    ${
                      isOpen
                        ? "border-light-accent dark:border-dark-accent shadow-xl ring-2 ring-light-accent/60 dark:ring-dark-accent/70"
                        : "border-light-border dark:border-dark-border hover:border-light-accent/70 dark:hover:border-dark-accent/70"
                    }
                  `}
                  style={{ position: isOpen ? "relative" : undefined }}
                >
                  <button
                    className={`
                      w-full text-left flex justify-between items-center px-6 py-4
                      font-semibold text-sm md:text-base focus:outline-none rounded-2xl
                      transition-colors
                      ${
                        isOpen
                          ? "text-light-accent dark:text-dark-accent bg-light-alt dark:bg-dark-alt"
                          : "text-light-text dark:text-dark-text bg-transparent"
                      }
                    `}
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`
                          inline-flex h-6 w-6 items-center justify-center rounded-full text-xs
                          ${
                            isOpen
                              ? "bg-light-accent text-white dark:bg-dark-accent"
                              : "bg-light-surfaceAlt text-light-textSecondary dark:bg-dark-surfaceAlt dark:text-dark-textSecondary"
                          }
                        `}
                        aria-hidden="true"
                      >
                        ?
                      </span>
                      <span>{f.q}</span>
                    </div>
                    <span className="ml-4 text-xl" aria-hidden="true">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  <Collapsible id={bodyId} isOpen={isOpen}>
                    {f.a}
                  </Collapsible>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
