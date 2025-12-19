// src/components/Layout/HowItWorks.js
"use client";
import React from "react";

// Defaults for the steps
export const DEFAULT_STEPS = [
  {
    icon: "📝",
    title: "Create Your Account",
    desc: "Sign up in seconds — it’s free to start.",
  },
  {
    icon: "📋",
    title: "Add Cards",
    desc: "Search and add your Pokémon cards to your collection.",
  },
  {
    icon: "📖",
    title: "Build Binders",
    desc: "Organise cards into custom digital binders — just like real life.",
  },
  {
    icon: "💡",
    title: "Wishlist",
    desc: "Track the cards you want to pick up next.",
  },
];

export default function HowItWorks({
  steps = DEFAULT_STEPS,
  title = "How It Works",
  className = "",
}) {
  const items = Array.isArray(steps) ? steps : DEFAULT_STEPS;
  const count = items.length;

  // Layout adapts to number of steps so 3 doesn't look odd
  let wrapperClasses = "grid gap-5";
  if (count === 1) {
    wrapperClasses += " max-w-md mx-auto grid-cols-1";
  } else if (count === 2) {
    wrapperClasses += " max-w-3xl mx-auto grid-cols-1 sm:grid-cols-2";
  } else if (count === 3) {
    wrapperClasses += " max-w-4xl mx-auto grid-cols-1 md:grid-cols-3";
  } else {
    // 4+ steps
    wrapperClasses += " sm:grid-cols-2 lg:grid-cols-4";
  }

  return (
    <section
      className={`
        py-12 px-4
        bg-light-background dark:bg-dark-background
        transition-colors
        ${className}
      `}
    >
      <div className="mx-auto max-w-5xl">
        {/* Heading + small intro */}
        <div className="text-center mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-light-textMuted dark:text-dark-textMuted">
            Get started in a few minutes
          </p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-light-text dark:text-dark-text drop-shadow-sm">
            {title}
          </h2>
          <p className="mt-3 text-sm md:text-base text-light-textSecondary dark:text-dark-textSecondary max-w-2xl mx-auto">
            A simple flow: create an account, add a few cards, and start
            organising your collection into binders and wishlists.
          </p>
        </div>

        {/* Steps */}
        <div className={wrapperClasses}>
          {items.map((step, idx) => {
            const titleText = step.title || step.name;
            const descText = step.desc ?? step.description ?? "";

            return (
              <div
                key={idx}
                className="
                  relative flex flex-col h-full
                  rounded-2xl border border-light-border dark:border-dark-border
                  bg-light-surface dark:bg-dark-surface
                  shadow-sm hover:shadow-md hover:-translate-y-0.5
                  transition-transform
                  px-4 pt-5 pb-5
                "
              >
                {/* Step number badge */}
                <div className="absolute -top-3 left-4">
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-light-accent text-white text-xs font-semibold shadow-sm dark:bg-dark-accent">
                    {idx + 1}
                  </div>
                </div>

                {/* Optional icon (you can drop this in your 3-step version if you want it cleaner) */}
                {step.icon && (
                  <div className="mt-3 mb-2 text-3xl" aria-hidden="true">
                    {step.icon}
                  </div>
                )}

                <h3 className="text-base md:text-lg font-semibold text-light-accent dark:text-dark-accent">
                  {titleText}
                </h3>

                <p className="mt-2 text-sm md:text-[15px] text-light-textSecondary dark:text-dark-textSecondary">
                  {descText}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
