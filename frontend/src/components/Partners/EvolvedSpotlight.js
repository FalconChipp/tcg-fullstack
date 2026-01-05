// src/components/Partners/EvolvedSpotlight.js
// NEW: Partner spotlight/ad panel using your design tokens.
// - Light/Dark aware (bg-light-*, dark:bg-dark-*)
// - next/image for logos/hero
// - Modes: "card" (default), "banner", "compact"
// - ENTIRE section constrained to max-w-[1440px] and centered.
//
// CHANGED: Support JSX tagline properly by building a fallback node INSIDE the component,
//          rather than using JSX in a default parameter (which caused your syntax error).
// CHANGED: Primary CTA text is white in dark mode.
// CHANGED: Section itself is max-w-[1440px] mx-auto (not just inner content).

"use client";

import React from "react";
import Image from "next/image";

const FALLBACK_LOGO =
  "https://placehold.co/240x80/png?text=Evolved+Protection";
const FALLBACK_HERO =
  "https://placehold.co/720x360/png?text=Protect+Your+Cards";

/**
 * PROPS
 * - partnerName: string
 * - tagline: string | React.ReactNode   // CHANGED: allow JSX
 * - blurb: string
 * - bullets: string[]
 * - ctaLabel: string
 * - ctaHref: string
 * - logoSrc: string
 * - heroSrc: string
 * - className: string
 * - onCtaClick: (e) => void
 * - mode: "card" | "banner" | "compact"
 */
export default function EvolvedProtectionSpotlight({
  partnerName = "Evolved Protection",
  tagline,
  blurb = "Trusted sleeves, toploaders & shields for serious collectors.",
  bullets = ["Sleeves that actually fit", "Toploaders you can trust", "UK-based, collector first"],
  ctaLabel = "Shop Evolved",
  ctaHref = "https://evolvedtrading.co.uk",
  logoSrc = FALLBACK_LOGO,
  heroSrc = FALLBACK_HERO,
  className = "",
  onCtaClick = null,
  mode = "banner", // "card" | "banner" | "compact"
}) {
  // CHANGED: Build a JSX fallback inside the function
  const taglineNode =
    tagline ??
    (
      <>
        Protect your pulls the <em>Evolved</em> way.
      </>
    );

  const handleCta = (e) => {
    if (onCtaClick) {
      try {
        onCtaClick(e);
      } catch {}
    }
  };

  const base =
    "transition-colors border rounded-2xl shadow-lg dark:shadow-[0_6px_24px_0_rgba(12,8,24,0.18)] bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border";

  if (mode === "banner") {
    return (
      <section
        className={`${base} ${className} overflow-hidden relative max-w-[1440px] mx-auto w-full`}
        aria-label={`${partnerName} spotlight`}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 md:gap-6 items-stretch">
          {/* Visual / hero */}
          <div className="md:col-span-5 relative min-h-[180px] md:min-h-[220px]">
            <Image
              src={heroSrc}
              alt={`${partnerName} hero`}
              fill
              sizes="(max-width: 768px) 100vw, 576px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-light-surface/0 to-light-surface/0 dark:from-black/20 dark:to-black/0 pointer-events-none" />
          </div>

          {/* Copy */}
          <div className="md:col-span-7 p-6 md:p-8 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-[160px] h-[36px] md:w-[200px] md:h-[44px]">
                <Image
                  src={logoSrc}
                  alt={`${partnerName} logo`}
                  fill
                  sizes="200px"
                  className="object-contain"
                />
              </div>
              <span className="text-sm px-2 py-1 rounded-md border border-light-border dark:border-dark-border text-light-textMuted dark:text-dark-textMuted">
                In partnership with SixByFive TCG
              </span>
            </div>

            {/* CHANGED: render taglineNode (string or JSX) */}
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {taglineNode}
            </h3>

            <p className="text-base text-light-textMuted dark:text-dark-textMuted">
              {blurb}
            </p>

            {Array.isArray(bullets) && bullets.length > 0 && (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {bullets.map((b, i) => (
                  <li
                    key={i}
                    className="text-sm text-light-textMuted dark:text-dark-textMuted"
                  >
                    • {b}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCta}
                // CTA label white in dark mode
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 font-semibold bg-light-accent dark:bg-dark-accent text-light-surface dark:text-white hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition"
                aria-label={`${ctaLabel} at ${partnerName}`}
              >
                {ctaLabel}
              </a>

              <span className="text-sm text-light-textMuted dark:text-dark-textMuted">
                Protect your cards while you manage your collection.
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (mode === "compact") {
    return (
      <section
        className={`${base} ${className} p-4 max-w-[1440px] mx-auto w-full`}
        aria-label={`${partnerName} quick promo`}
      >
        <div className="flex gap-4 items-center">
          <div className="relative w-[120px] h-[34px] shrink-0">
            <Image
              src={logoSrc}
              alt={`${partnerName} logo`}
              fill
              sizes="120px"
              className="object-contain"
            />
          </div>

          <div className="flex-1">
            <p className="text-sm">
              <span className="font-semibold">{partnerName}</span> — sleeves,
              toploaders & shields that actually fit and protect.
            </p>
            <div className="mt-2">
              <a
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleCta}
                className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold border-2 border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent hover:bg-light-accent dark:hover:bg-dark-accent hover:text-light-surface dark:hover:text-dark-surface transition"
              >
                {ctaLabel}
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // DEFAULT: CARD layout
  return (
    <section
      className={`${base} ${className} overflow-hidden max-w-[1440px] mx-auto w-full`}
      aria-label={`${partnerName} spotlight`}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {/* Left: text block */}
        <div className="p-6 md:p-8 md:col-span-2 flex flex-col">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-[180px] h-[40px]">
              <Image
                src={logoSrc}
                alt={`${partnerName} logo`}
                fill
                sizes="180px"
                className="object-contain"
                priority
              />
            </div>
            <span className="text-xs px-2 py-1 rounded-md border border-light-border dark:border-dark-border text-light-textMuted dark:text-dark-textMuted">
              In partnership with SixByFive TCG
            </span>
          </div>

          {/* CHANGED: render taglineNode (string or JSX) */}
          <h3 className="text-2xl font-extrabold tracking-tight">
            {taglineNode}
          </h3>

          <p className="mt-2 text-base text-light-textMuted dark:text-dark-textMuted">
            {blurb}
          </p>

          {Array.isArray(bullets) && bullets.length > 0 && (
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="text-sm text-light-textMuted dark:text-dark-textMuted"
                >
                  • {b}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleCta}
              // CTA label white in dark mode
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 font-semibold bg-light-accent dark:bg-dark-accent text-light-surface dark:text-white hover:bg-light-accentLight dark:hover:bg-dark-accentLight transition"
              aria-label={`${ctaLabel} at ${partnerName}`}
            >
              {ctaLabel}
            </a>
            <a
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline underline-offset-2 text-light-textMuted dark:text-dark-textMuted hover:text-light-text dark:hover:text-dark-text"
            >
              Learn more
            </a>
          </div>
        </div>

        {/* Right: hero image */}
        <div className="relative min-h-[200px] md:min-h-[100%]">
          <Image
            src={heroSrc}
            alt={`${partnerName} product preview`}
            fill
            sizes="(max-width: 768px) 100vw, 480px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-light-surface/0 via-transparent to-transparent dark:from-black/10 dark:via-black/0 dark:to-black/0 pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
