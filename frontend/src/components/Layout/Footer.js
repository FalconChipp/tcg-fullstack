'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Accent-hovering link for navigation, matches header's logic for active/hover states
function FooterLink({ href, children }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`
        text-base font-medium px-1 py-0.5 border-b-2 transition
        ${isActive
          ? "text-light-accent dark:text-dark-accent font-bold border-light-accent dark:border-dark-accent"
          : "text-light-textSecondary dark:text-dark-textSecondary border-transparent"}
        hover:text-light-accent dark:hover:text-dark-accent
        hover:border-light-accent dark:hover:border-dark-accent
        transition-colors
      `}
    >
      {children}
    </Link>
  );
}

// Social link, opens in new tab, matches header hover style
function FooterSocialLink({ href, children }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        text-base font-medium px-1 py-0.5 border-b-2 border-transparent
        text-light-textSecondary dark:text-dark-textSecondary
        hover:text-light-accent dark:hover:text-dark-accent
        hover:border-light-accent dark:hover:border-dark-accent
        transition-colors
      `}
    >
      {children}
    </Link>
  );
}

export default function Footer({ onCookieSettingsClick }) {
  return (
    <footer className="
      w-full z-10 relative
      bg-light-surface/90 dark:bg-dark-surface/90
      border-t border-light-border dark:border-dark-border
      backdrop-blur
      shadow-inner
      text-light-textSecondary dark:text-dark-textSecondary
      px-4 sm:px-8 py-7
      rounded-t-3xl
      transition-colors
    ">
      <div className="max-w-6xl mx-auto flex flex-col gap-6 md:gap-0 md:flex-row items-center justify-between">
        {/* Branding + Quick Links */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-10">
          {/* Branding */}
          <div className="mb-1 md:mb-0">
            <h2 className="font-extrabold text-lg md:text-2xl tracking-tight text-light-accent dark:text-dark-accent">
              SIXBYFIVE <span className="font-mono text-xs text-light-accent dark:text-dark-accentLight">TCG</span>
            </h2>
            <span className="text-xs text-light-textMuted dark:text-dark-textMuted block mt-1">
              &copy; {new Date().getFullYear()} SixByFive. All rights reserved.
            </span>
          </div>
          {/* Navigation Links */}
          <nav className="flex gap-5 text-sm font-medium mt-1 md:mt-0">
            <FooterLink href="/about">About</FooterLink>
            {/* <FooterLink href="/contact">Contact</FooterLink> */}
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
          </nav>
        </div>

        {/* Social + Cookie */}
        <div className="flex flex-col items-center md:items-end gap-2 md:gap-3">
          {/* <div className="flex gap-3 items-center">
            <span className="text-xs text-light-textMuted dark:text-dark-textMuted">Follow us:</span>
            <FooterSocialLink href="https://twitter.com">Twitter</FooterSocialLink>
            <FooterSocialLink href="https://facebook.com">Facebook</FooterSocialLink>
            <FooterSocialLink href="https://instagram.com">Instagram</FooterSocialLink>
          </div> */}
          <button
            className="
              text-xs mt-1 text-light-textMuted dark:text-dark-textMuted
              hover:text-light-accent dark:hover:text-dark-accent
              transition underline underline-offset-2
            "
            onClick={onCookieSettingsClick}
            type="button"
          >
            Cookie Settings
          </button>
        </div>
      </div>

      {/* Disclaimer below main row */}
      <div className="
        max-w-6xl mx-auto mt-7 pt-4 border-t border-light-border dark:border-dark-border
        text-xs text-light-textMuted dark:text-dark-textMuted text-center
      ">
        All Pokémon sprites, card imagery, and set logos are copyright &copy; Nintendo, Creatures, GAME FREAK, The Pokémon Company, or their respective owners.<br />
        This site is a fan project and is not affiliated with or endorsed by any of these companies.
      </div>
    </footer>
  );
}
