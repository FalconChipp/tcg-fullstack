// src/components/Layout/Footer.js (or wherever this lives)
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* ---------------------------- Helper: Nav link ---------------------------- */
// Accent-hovering link for navigation, matches header-style hover/active states
function FooterLink({ href, children }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`
        text-sm font-medium border-b-2 px-0.5 pb-0.5
        ${
          isActive
            ? "text-light-accent dark:text-dark-accent border-light-accent dark:border-dark-accent"
            : "text-light-textSecondary dark:text-dark-textSecondary border-transparent"
        }
        hover:text-light-accent dark:hover:text-dark-accent
        hover:border-light-accent dark:hover:border-dark-accent
        transition-colors
      `}
    >
      {children}
    </Link>
  );
}

/* ------------------------- Helper: External/social link ------------------------ */
// Uses <a> for external links with target=_blank
function FooterSocialLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        text-sm font-medium border-b-2 border-transparent
        text-light-textSecondary dark:text-dark-textSecondary
        hover:text-light-accent dark:hover:text-dark-accent
        hover:border-light-accent dark:hover:border-dark-accent
        transition-colors
      `}
    >
      {children}
    </a>
  );
}

/* --------------------------- Helper: Play badge --------------------------- */

function GooglePlayBadge({ className = "" }) {
  return (
    <span
      className={`
        inline-flex items-center rounded-xl border border-light-border dark:border-dark-border
        bg-white dark:bg-dark-surface px-3 py-2 shadow-sm ${className}
      `}
    >
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        className="mr-2"
      >
        <path
          d="M3.27 2.27L13.5 12.5 3.27 22.73a2 2 0 01-.27-1.03V3.3c0-.37.09-.71.27-1.03z"
          fill="#34A853"
        />
        <path
          d="M14.88 13.88l2.69 2.69-11 6.35a2 2 0 01-1.54.12l9.85-9.16z"
          fill="#FBBC04"
        />
        <path
          d="M17.57 11.19l-2.69 2.69L3.92 2.01a2 2 0 011.54.12l12.11 7.06z"
          fill="#4285F4"
        />
        <path
          d="M20.63 10.06a2 2 0 010 3.88l-2.17 1.27-2.69-2.69 2.69-2.69 2.17 1.23z"
          fill="#EA4335"
        />
      </svg>
      <span className="text-left leading-tight">
        <span className="block text-[9px] text-zinc-600 dark:text-zinc-400">
          GET IT ON
        </span>
        <span className="block text-[13px] font-semibold text-zinc-900 dark:text-white">
          Google Play
        </span>
      </span>
    </span>
  );
}

/* ------------------------------ Main footer ------------------------------ */

export default function Footer({ onCookieSettingsClick = () => {} }) {
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="
        w-full z-10 relative
        bg-light-surface/95 dark:bg-dark-surface/95
        border-t border-light-border dark:border-dark-border
        backdrop-blur
        shadow-inner
        text-light-textSecondary dark:text-dark-textSecondary
        px-4 sm:px-8 pt-9 pb-8
        rounded-t-3xl
        transition-colors
      "
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top grid: brand + nav + community/app */}
        <div className="grid grid-cols-1 md:grid-cols-[1.7fr_1.2fr_1.2fr] gap-8 items-start">
          {/* Brand & tagline */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="font-extrabold text-xl md:text-2xl tracking-tight text-light-accent dark:text-dark-accent">
                SIXBYFIVE{" "}
                <span className="font-mono text-xs text-light-accentLight dark:text-dark-accentLight">
                  TCG
                </span>
              </h2>
            </div>

            <p className="text-sm text-light-textSecondary dark:text-dark-textSecondary max-w-sm">
              Track, value, and show off your Pokémon collection — on web and
              mobile.
            </p>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-light-border dark:border-dark-border bg-light-surfaceAlt/70 dark:bg-dark-surfaceAlt/70 px-3 py-1 text-[11px] text-light-textMuted dark:text-dark-textMuted">
              <span role="img" aria-label="United Kingdom flag">
                🇬🇧
              </span>
              <span>Made in the UK, built for collectors everywhere.</span>
            </div>

            <p className="mt-3 text-xs text-light-textMuted dark:text-dark-textMuted">
              &copy; {year} SixByFive. All rights reserved.
            </p>
          </div>

          {/* Product / navigation */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-light-textMuted dark:text-dark-textMuted mb-3">
              Product
            </h3>
            <ul className="space-y-1.5">
              <li>
                <FooterLink href="/">Home</FooterLink>
              </li>
              <li>
                <FooterLink href="/sets">Sets</FooterLink>
              </li>
              <li>
                <FooterLink href="/blog">Dev Blog</FooterLink>
              </li>
              <li>
                <FooterLink href="/about">About</FooterLink>
              </li>
            </ul>

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-light-textMuted dark:text-dark-textMuted mb-3">
              Legal
            </h3>
            <ul className="space-y-1.5">
              <li>
                <FooterLink href="/privacy">Privacy</FooterLink>
              </li>
              <li>
                <FooterLink href="/terms">Terms</FooterLink>
              </li>
            </ul>
          </div>

          {/* Community, app & cookies */}
          <div className="flex flex-col gap-4 items-start md:items-end">
            <div className="w-full md:w-auto">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-light-textMuted dark:text-dark-textMuted mb-3 md:text-right">
                Community
              </h3>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <FooterSocialLink href="https://discord.gg/PRMbMbRE2H">
                  Discord
                </FooterSocialLink>
                <FooterSocialLink href="https://www.linkedin.com/company/sixbyfive/">
                  LinkedIn
                </FooterSocialLink>
              </div>
            </div>

            <div className="w-full md:w-auto">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-light-textMuted dark:text-dark-textMuted mb-3 md:text-right">
                Mobile app
              </h3>
              <div className="flex justify-start md:justify-end">
                <a
                  href="https://play.google.com/store/apps/details?id=com.sixbyfive.sbftcgmobile"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Get SixByFive TCG on Google Play"
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-accent dark:focus-visible:ring-dark-accent rounded-xl"
                >
                  <GooglePlayBadge className="scale-[0.9]" />
                </a>
              </div>
              <p className="mt-1 text-[11px] text-light-textMuted dark:text-dark-textMuted md:text-right">
                iOS version in development.
              </p>
            </div>

            <button
              className="
                text-xs text-light-textMuted dark:text-dark-textMuted
                hover:text-light-accent dark:hover:text-dark-accent
                underline underline-offset-2 mt-1
                transition-colors
              "
              onClick={onCookieSettingsClick}
              type="button"
              aria-label="Open cookie settings"
            >
              Cookie settings
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="pt-4 border-t border-light-border dark:border-dark-border text-[11px] text-light-textMuted dark:text-dark-textMuted text-center leading-relaxed">
          All Pokémon sprites, card imagery, and set logos are copyright &copy;{" "}
          Nintendo, Creatures, GAME FREAK, The Pokémon Company, or their
          respective owners.
          <br />
          This site is a fan project and is not affiliated with or endorsed by
          any of these companies.
        </div>
      </div>
    </footer>
  );
}
