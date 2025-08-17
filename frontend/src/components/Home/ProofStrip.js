// src/components/Home/ProofStrip.js
"use client";
import React from "react";

// NEW: default invite aligned with the rest of the site; override via prop if needed
const DISCORD_INVITE = "https://discord.gg/PRMbMbRE2H";

export default function ProofStrip({
  invite = DISCORD_INVITE, // CHANGED: replace hardcoded placeholder with prop + default
  className = "",          // NEW: allow external spacing overrides
}) {
  return (
    // CHANGED: keep container width but add responsive max widths to match other sections
    <section className={`max-w-4xl md:max-w-5xl mx-auto px-4 py-6 ${className}`}>
      <div
        className={`
          // CHANGED: solid surfaces (removed /60 opacity) to match cards/bars
          rounded-2xl border border-light-border dark:border-dark-border
          bg-light-surface dark:bg-dark-surface
          // NEW: consistent elevation with other surfaces
          shadow-lg ring-1 ring-black/5 dark:ring-black/20
          // CHANGED: layout mirrors your existing bars
          px-5 py-4 flex flex-col md:flex-row items-center
          justify-center md:justify-between gap-3 text-sm
        `}
      >
        {/* CHANGED: use *Secondary* tone to align with body copy */}
        <div className="flex items-center gap-2 text-light-textSecondary dark:text-dark-textSecondary">
          <span aria-hidden="true">🇬🇧</span>
          <span>Built for UK Pokémon TCG collectors</span>
        </div>

        {/* NEW: subtle divider only on wider layouts */}
        <div
          className="hidden md:block h-5 w-px bg-light-border dark:bg-dark-border"
          aria-hidden="true"
        />

        <div className="flex items-center gap-2 text-light-textSecondary dark:text-dark-textSecondary">
          <span aria-hidden="true">✅</span>
          <span>Early access — live now</span>
        </div>

        {/* NEW: second divider before the CTA */}
        <div
          className="hidden md:block h-5 w-px bg-light-border dark:bg-dark-border"
          aria-hidden="true"
        />

        {/* CHANGED: real link target with proper a11y; accent underlined link matches site */}
        <a
          href={invite}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-light-accent dark:text-dark-accent underline underline-offset-4"
          aria-label="Join our Discord"
        >
          Join our Discord
        </a>
      </div>
    </section>
  );
}
