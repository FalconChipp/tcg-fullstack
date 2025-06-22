"use client";
import React, { useState } from "react";

const faqs = [
  {
    q: "Who can see my collection and binders?",
    a: "All user profiles, binders, and collections are public by default. Anyone can view your profile or share links to your binders and cards.",
  },
  {
    q: "Can I organise my collection into multiple binders?",
    a: "Yes! You can create as many digital binders as you like, each with its own name, cover, and layout.",
  },
  {
    q: "How do I add cards to my collection?",
    a: "Use the advanced search on the homepage to find cards by set, number, or rarity, then add them directly to your collection or binder.",
  },
  {
    q: "Is the site free to use?",
    a: "Yes. All collection and binder features are free during the beta period. Premium features may be introduced in the future, but the core platform will always offer a free tier.",
  },
  {
    q: "What card games are supported?",
    a: "The platform currently supports the Pokémon TCG. Support for other games like Magic: The Gathering and Disney Lorcana is planned.",
  },
  {
    q: "When will trading and the marketplace go live?",
    a: "Trading and the marketplace are coming soon! Join our Discord or sign up for updates to get notified as soon as these features launch.",
  },
  {
    q: "Can I export my collection?",
    a: "Export features will be added after the trading and marketplace modules go live. For now, you can manage everything directly on the site.",
  },
  {
    q: "How do I give feedback or suggest new features?",
    a: "We love feedback! Join our Discord community or use the contact page to let us know what you’d like to see next.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);

  return (
    <section className="py-12 px-2 sm:px-4 bg-light-background dark:bg-dark-background transition-colors">
      <h2 className="text-3xl font-bold text-center mb-10 text-light-text dark:text-dark-text drop-shadow">
        FAQ
      </h2>
      <div className="max-w-2xl mx-auto space-y-4">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className={`
                rounded-2xl border transition-all
                bg-light-surface dark:bg-dark-surface
                ${isOpen 
                  ? "border-light-accent dark:border-dark-accent shadow-xl" 
                  : "border-light-border dark:border-dark-border"}
                ${isOpen ? "ring-2 ring-light-accent dark:ring-dark-accent" : "hover:border-light-accent dark:hover:border-dark-accent"}
                ${isOpen ? "z-10" : ""}
              `}
              style={{
                // Slight lift for open
                position: isOpen ? 'relative' : undefined
              }}
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
                aria-controls={`faq-body-${i}`}
              >
                <span>{f.q}</span>
                <span className="ml-4 text-xl">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {/* Animated answer */}
              <div
                id={`faq-body-${i}`}
                className={`
                  px-6 text-light-textSecondary dark:text-dark-textSecondary overflow-hidden
                  transition-all duration-300 ease-in-out
                  ${isOpen ? "max-h-40 opacity-100 pb-4" : "max-h-0 opacity-0 pb-0"}
                `}
                style={{
                  maxHeight: isOpen ? "400px" : "0px",
                  opacity: isOpen ? 1 : 0,
                }}
              >
                {f.a}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}