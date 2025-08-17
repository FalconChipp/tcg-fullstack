// src/components/Layout/HowItWorks.js
"use client";
import React from "react";

// NEW: sane defaults (Title Case, concise British English)
export const DEFAULT_STEPS = [
  {
    icon: "📝",
    title: "Create Your Account", // CHANGED (Title Case)
    desc: "Sign up in seconds — it’s free to start.", // CHANGED (tighter)
  },
  {
    icon: "📋",
    title: "Add Cards",
    desc: "Search and add your Pokémon cards to your collection.", // CHANGED (benefit-first)
  },
  {
    icon: "📖",
    title: "Build Binders",
    desc: "Organise cards into custom digital binders — just like real life.", // CHANGED (tone)
  },
  {
    icon: "💡",
    title: "Wishlist",
    desc: "Track the cards you want to pick up next.", // CHANGED (shorter)
  },
];

export default function HowItWorks({
  steps = DEFAULT_STEPS, // NEW: accepts overrides (e.g., from OnboardingQuickStart)
  title = "How It Works", // NEW: customisable heading
  className = "",         // NEW: layout control from parent
}) {
  // CHANGED: tolerate either {desc} or {description} from callers
  const items = Array.isArray(steps) ? steps : DEFAULT_STEPS;

  return (
    <section
      className={`
        py-12 px-2 sm:px-4 
        bg-light-background dark:bg-dark-background
        transition-colors
        ${className}
      `}
    >
      <h2 className="text-3xl font-bold text-center mb-10 text-light-text dark:text-dark-text drop-shadow">
        {title}
      </h2>

      <div className="flex flex-col md:flex-row justify-center items-stretch gap-6 max-w-5xl mx-auto">
        {items.map((step, idx) => {
          const titleText = step.title || step.name; // NEW: fallback
          const descText = step.desc ?? step.description ?? ""; // CHANGED: support both keys

          return (
            <div
              key={idx}
              className="
                flex-1 flex flex-col items-center 
                bg-light-surface dark:bg-dark-surface
                rounded-2xl p-7
                shadow-lg ring-1 ring-black/5 dark:ring-black/20
                transition-transform hover:-translate-y-1 hover:shadow-2xl
                border border-light-border dark:border-dark-border
                min-w-[220px]
              "
            >
              {step.icon ? (
                <div className="text-4xl md:text-5xl mb-3" aria-hidden="true">
                  {step.icon}
                </div>
              ) : null}

              <div className="font-semibold text-lg md:text-xl text-light-accent dark:text-dark-accent mb-2 text-center">
                {titleText}
              </div>

              <div className="text-light-textSecondary dark:text-dark-textSecondary text-base text-center">
                {descText}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
