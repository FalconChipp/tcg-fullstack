"use client";
import React, { useState, useRef, useEffect } from "react"; // CHANGED: add refs/effect for smooth height animation

// NEW: centralise invite for reuse in copy (edit if needed)
const DISCORD_INVITE = "https://discord.gg/PRMbMbRE2H";

// CHANGED: reordered & tightened answers; added a price-tracking FAQ
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

// NEW: collapsible answer with measured height (no hard-coded max)
function Collapsible({ id, isOpen, children }) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // measure when open or content changes
    if (innerRef.current) {
      const h = innerRef.current.scrollHeight;
      setHeight(h);
    }
  }, [isOpen, children]);

  return (
    <div
      id={id}
      className={`
        px-6 text-light-textSecondary dark:text-dark-textSecondary overflow-hidden
        transition-all duration-300 ease-in-out
        ${isOpen ? "opacity-100 pb-4" : "opacity-0 pb-0"}
      `}
      style={{ maxHeight: isOpen ? height : 0 }}
      aria-hidden={!isOpen}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

export default function FAQ() {
  const [open, setOpen] = useState(null);

  return (
    <section className="py-12 px-2 sm:px-4 bg-light-background dark:bg-dark-background transition-colors">
      <h2 className="text-3xl font-bold text-center mb-10 text-light-text dark:text-dark-text drop-shadow">
        FAQ
      </h2>

      <div className="max-w-2xl mx-auto space-y-4">
        {FAQ_ITEMS.map((f, i) => {
          const isOpen = open === i;
          const bodyId = `faq-body-${i}`;

          return (
            <div
              key={i}
              className={`
                rounded-2xl border transition-all
                bg-light-surface dark:bg-dark-surface
                ${isOpen
                  ? "border-light-accent dark:border-dark-accent shadow-xl"
                  : "border-light-border dark:border-dark-border"}
                ${isOpen
                  ? "ring-2 ring-light-accent dark:ring-dark-accent"
                  : "hover:border-light-accent dark:hover:border-dark-accent"}
                ${isOpen ? "z-10" : ""}
              `}
              style={{ position: isOpen ? "relative" : undefined }}
            >
              <button
                className={`
                  w-full text-left flex justify-between items-center px-6 py-4
                  font-semibold text-lg focus:outline-none focus:ring-2 rounded-2xl
                  transition-colors
                  ${isOpen
                    ? "text-light-accent dark:text-dark-accent bg-light-alt dark:bg-dark-alt"
                    : "text-light-text dark:text-dark-text bg-transparent"}
                `}
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={bodyId}
              >
                <span>{f.q}</span>
                <span className="ml-4 text-xl" aria-hidden="true">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {/* CHANGED: answer now uses measured height for smooth animation */}
              <Collapsible id={bodyId} isOpen={isOpen}>
                {f.a}
              </Collapsible>
            </div>
          );
        })}
      </div>
    </section>
  );
}
