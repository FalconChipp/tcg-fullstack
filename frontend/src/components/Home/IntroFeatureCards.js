// src/components/Home/IntroFeatureCards.js
"use client";
import React from "react";

export default function IntroFeatureCards({ className = "" }) { // NEW: className for external control
  return (
    <section className={`max-w-3xl mx-auto py-10 px-4 text-center ${className}`}>
      {/* CHANGED: tone/format consistent with site headings */}
      <h2 className="text-3xl font-bold mb-4 text-light-primary dark:text-dark-primary">
        Your collection, organised and up to date.
      </h2>

      {/* CHANGED: use secondary body tone to align with the rest of the site */}
      <p className="text-lg mb-8 text-light-textSecondary dark:text-dark-textSecondary">
        Add cards in seconds, build shareable binders, and see your value at a glance — fast, free, and built for UK collectors.
      </p>

      <div className="flex flex-col md:flex-row gap-6 justify-center">
        {/* Card 1 — CHANGED: add ring for consistent elevation */}
        <div className="
          bg-light-surface dark:bg-dark-surface rounded-2xl p-7
          shadow-lg ring-1 ring-black/5 dark:ring-black/20
          flex-1 border border-light-border dark:border-dark-border
        ">
          <h3 className="font-semibold text-lg mb-2 text-light-accent dark:text-dark-accent">
            <span aria-hidden="true" className="mr-1">🗃️</span>
            Digital Collection Manager
          </h3>
          <p className="text-light-text dark:text-dark-text">
            Track what you own and what it’s worth — all in one place.
          </p>
        </div>

        {/* Card 2 — CHANGED: add ring; keep copy */}
        <div className="
          bg-light-surface dark:bg-dark-surface rounded-2xl p-7
          shadow-lg ring-1 ring-black/5 dark:ring-black/20
          flex-1 border border-light-border dark:border-dark-border
        ">
          <h3 className="font-semibold text-lg mb-2 text-light-accent dark:text-dark-accent">
            <span aria-hidden="true" className="mr-1">📒</span>
            Custom Binders
          </h3>
          <p className="text-light-text dark:text-dark-text">
            Recreate your real binders online with layouts, covers, and shareable links.
          </p>
        </div>

        {/* Card 3 — CHANGED: add ring; keep copy */}
        <div className="
          bg-light-surface dark:bg-dark-surface rounded-2xl p-7
          shadow-lg ring-1 ring-black/5 dark:ring-black/20
          flex-1 border border-light-border dark:border-dark-border
        ">
          <h3 className="font-semibold text-lg mb-2 text-light-accent dark:text-dark-accent">
            <span aria-hidden="true" className="mr-1">💬</span>
            Community & Achievements
          </h3>
          <p className="text-light-text dark:text-dark-text">
            Get help, trade tips, and earn early-adopter badges in our Discord.
          </p>
        </div>
      </div>
    </section>
  );
}
