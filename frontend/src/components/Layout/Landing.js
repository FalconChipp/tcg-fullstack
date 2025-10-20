"use client";
/**
 * Under Maintenance Landing
 *
 * SUMMARY OF CHANGES
 * - REMOVED: Registration form, GraphQL register mutation, react-hook-form, password rules, Terms/Privacy consent.
 * - REMOVED: Launch-specific copy and the fixed 2025-08-01 countdown target.
 * - ADDED: Maintenance-focused hero, optional ETA countdown (via env), system status tiles, action buttons.
 * - ADDED: Safer env-driven links for Status/Discord so you don’t ship broken anchors.
 * - CHANGED: Kept the same gradient + light/dark tokens for visual consistency.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
// import { useForm } from "react-hook-form";                // REMOVED
// import StatusMessage from "@/components/UI/StatusMessage"; // REMOVED
// import { setCookie } from "@/utils/cookieUtils";           // REMOVED
import { useTheme } from "@/hooks/ThemeProvider";

// =============================
// ADDED: Optional Maintenance ETA via env
//   - Set NEXT_PUBLIC_MAINTENANCE_END to an ISO string (e.g. "2025-09-05T09:00:00+01:00")
//   - Set NEXT_PUBLIC_STATUS_URL to your status page URL or route (defaults to "/status")
//   - Set NEXT_PUBLIC_DISCORD_URL if you want a Discord button visible
// =============================
const MAINTENANCE_END_ENV = process.env.NEXT_PUBLIC_MAINTENANCE_END || "";
const STATUS_URL = process.env.NEXT_PUBLIC_STATUS_URL || "/status";
const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL || "";

// --- Countdown utility (kept, repurposed) ---
function getCountdown(targetDate) {
  if (!targetDate) return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  if (Number.isNaN(diff) || diff <= 0)
    return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, ended: false };
}

export default function Landing() {
  // NOTE: kept the component name 'Landing' to avoid import changes elsewhere.
  const { dark } = useTheme?.() || {}; // unchanged usage pattern

  // =============================
  // ADDED: Maintenance ETA countdown (env-driven)
  // =============================
  const expectedBack = useMemo(
    () => (MAINTENANCE_END_ENV ? new Date(MAINTENANCE_END_ENV) : null),
    []
  );
  const [countdown, setCountdown] = useState(getCountdown(expectedBack));
  useEffect(() => {
    if (!expectedBack) return;
    const id = setInterval(() => setCountdown(getCountdown(expectedBack)), 1000);
    return () => clearInterval(id);
  }, [expectedBack]);

  // =============================
  // ADDED: Simple local “status tiles” (placeholder)
  // Replace with live data if you have a status endpoint.
  // =============================
  const components = [
    { name: "API", status: "operational" },
    { name: "Website", status: "operational" },
    { name: "App", status: "operational" },
    { name: "Database", status: "maintenance" },
  ];

  // --- Format countdown text (repurposed) ---
  const countdownText = countdown.ended
    ? "Back shortly"
    : `${countdown.days}d ${String(countdown.hours).padStart(2, "0")}h ${String(
        countdown.minutes
      ).padStart(2, "0")}m ${String(countdown.seconds).padStart(2, "0")}s`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-accent/5 via-light-background to-light-surface dark:from-dark-surface dark:via-dark-background dark:to-dark-alt flex flex-col">
      {/* HEADER / HERO */}
      <header className="w-full py-14 px-4 text-center flex flex-col items-center">
        <div className="max-w-2xl mx-auto">
          {/* CHANGED: Hero copy */}
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold mb-4 text-light-accent dark:text-dark-accent">
            We’re doing some maintenance
          </h1>

          {/* ADDED: ETA pill (only shows if env provided) */}
          {expectedBack ? (
            <div className="mb-4">
              <span className="inline-block text-lg md:text-xl font-bold px-4 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-sm text-light-accent dark:text-dark-accent">
                Estimated time to back online: {countdownText}
              </span>
              <p className="mt-2 text-xs text-light-textMuted dark:text-dark-textMuted">
                Target: {expectedBack.toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="mb-4">
              <span className="inline-block text-lg md:text-xl font-bold px-4 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-sm text-light-accent dark:text-dark-accent">
                We’ll be back soon
              </span>
            </div>
          )}

          {/* CHANGED: Subheading */}
          <p className="text-lg md:text-xl text-light-textSecondary dark:text-dark-textSecondary font-medium mb-8">
            SixByFive TCG is temporarily offline while we upgrade servers and ship new features.
            Thanks for your patience!
          </p>

          {/* ADDED: Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text font-semibold text-base py-2 px-4 hover:border-light-accent dark:hover:border-dark-accent transition-colors"
            >
              Retry now
            </button>
            {DISCORD_URL ? (
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noreferrer"
              className="rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-text dark:text-dark-text font-semibold text-base py-2 px-4 hover:border-light-accent dark:hover:border-dark-accent transition-colors"
              >
                Join our Discord
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {/* ADDED: “What’s affected” / status tiles */}
      <section className="max-w-2xl mx-auto w-full px-4">
        <h3 className="text-xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
          What’s affected?
        </h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {components.map((c) => {
            const isUp = c.status === "operational";
            return (
              <li
                key={c.name}
                className="flex items-center justify-between rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface px-4 py-3"
              >
                <span className="font-medium text-light-text dark:text-dark-text">{c.name}</span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    isUp
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                  }`}
                >
                  {isUp ? "Operational" : "Maintenance"}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-light-textMuted dark:text-dark-textMuted">
          Tip: If you’re seeing this page unexpectedly, try clearing cache and reloading.
        </p>
      </section>

      {/* ADDED: FAQ (maintenance-flavoured) */}
      <section className="max-w-2xl mx-auto mb-8 mt-10 px-4">
        <h3 className="text-xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
          Frequently Asked Questions
        </h3>
        <div className="mb-4">
          <span className="font-semibold text-light-accent dark:text-dark-accent">
            How long will this take?
          </span>
          <p className="text-light-text dark:text-dark-text">
            We aim to minimize downtime. {expectedBack ? "See the ETA above." : "We’ll update our status page ASAP."}
          </p>
        </div>
        <div className="mb-4">
          <span className="font-semibold text-light-accent dark:text-dark-accent">
            Will I lose my data?
          </span>
          <p className="text-light-text dark:text-dark-text">
            No. Your collections, binders, and account data are safe.
          </p>
        </div>
      </section>

      {/* FOOTER (kept pattern) */}
      <footer className="mt-auto py-6 text-center text-xs text-light-textMuted dark:text-dark-textMuted">
        &copy; {new Date().getFullYear()} SixByFive{" "}
        <Link href="/privacy" className="underline text-light-accent dark:text-dark-accent">
          Privacy
        </Link>{" "}
        <Link href="/terms" className="underline text-light-accent dark:text-dark-accent">
          Terms
        </Link>
      </footer>
    </div>
  );
}
