// src/pages/mobile-block.js
//
// UPDATED to match site styles + keep desktop auto-bounce.
// CHANGED: Playful copy; say “not designed for mobile” (not “not available”).
// NEW: Buttons include Google Play & App Store logos (inline SVGs).
// Keeps server-side desktop detection: desktop users are redirected back to `from` (or /).
// Uses your Layout + design tokens.

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";


const PLAY_URL = "https://play.google.com/apps/testing/com.sixbyfive.sbftcgmobile";

export async function getServerSideProps({ req, query }) {
  const from = typeof query.from === "string" ? stripToPath(query.from) : "/";

  // Header-based detection (same signals as your redirects())
  const ua = req.headers["user-agent"] || "";
  const chMobile = req.headers["sec-ch-ua-mobile"]; // "?1" on Chromium mobile

  // QA switch still supported
  const forceMobile = query.forceMobile === "1";

  // Treat as "mobile" if client hint says so, UA looks mobile, or QA forced
  const looksMobile =
    forceMobile ||
    chMobile === "?1" ||
    /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(ua);

  // If NOT mobile, bounce away from /mobile-block automatically
  if (!looksMobile) {
    return {
      redirect: {
        destination: from || "/",
        permanent: false, // 307
      },
    };
  }

  return { props: { from } };
}

function stripToPath(input = "/") {
  try {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      const u = new URL(input);
      return u.pathname + (u.search || "");
    }
    if (/^[a-zA-Z]+:/.test(input)) return "/";
    return input.startsWith("/") ? input : `/${input}`;
  } catch {
    return "/";
  }
}

export default function MobileBlockPage({ from = "/" }) {
  const router = useRouter();
  const back = typeof router.query.from === "string" ? stripToPath(router.query.from) : from;

  return (
    <>
        {/* NEW: Meta (keep search engines away from this utility page) */}
      <Head>
        <title>Best on the app — SixByFive TCG</title> {/* CHANGED title */}
        <meta name="robots" content="noindex, nofollow" />
        <meta name="theme-color" content="#000000" />
      </Head>

      <main className="min-h-[70vh]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div
            className={[
              "mt-10 sm:mt-16",
              "rounded-2xl border",
              "bg-light-surface dark:bg-dark-surface",
              "border-light-border dark:border-dark-border",
              "shadow-sm",
              "p-6 sm:p-8",
            ].join(" ")}
          >
            {/* CHANGED: Playful headline & copy */}
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              Psst… this page isn’t built for thumbs 👀
            </h1>

            <p className="text-base text-light-subtle dark:text-dark-subtle mb-2">
              Our website isn’t <strong>designed for mobile screens</strong>. The full SixByFive TCG
              experience lives in our app—made for speed, small screens, and on-the-go collecting.
            </p>

            <p className="text-base text-light-subtle dark:text-dark-subtle mb-6">
              Grab the app below to manage your collection, build binders, track prices, and more.
            </p>

            {/* CHANGED: Store buttons with logos */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              {/* Google Play button */}
              <a
                href={PLAY_URL}
                className={[
                  "group inline-flex items-center justify-center gap-3",
                  "rounded-xl px-4 py-2 text-sm font-medium",
                  "border border-light-border dark:border-dark-border",
                  "bg-light-elevated hover:bg-light-elevated/80",
                  "dark:bg-dark-elevated dark:hover:bg-dark-elevated/80",
                  "transition focus:outline-none focus:ring-2 focus:ring-offset-2",
                ].join(" ")}
                aria-label="Get SixByFive TCG on Google Play"
              >
                {/* NEW: Google Play triangle icon (inline SVG) */}
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <defs>
                    <linearGradient id="gp_grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00C3FF" />
                      <stop offset="50%" stopColor="#2EFFA8" />
                      <stop offset="100%" stopColor="#FFD54A" />
                    </linearGradient>
                  </defs>
                  <path fill="url(#gp_grad)" d="M3.6 2.7c-.5.3-.8.9-.8 1.5v15.6c0 .6.3 1.2.8 1.5l10.4-9.3L3.6 2.7zM21 11.5L17 9l-2.8 2.5L17 14l4-2.5zm-6.9 2.5L4.1 22c.6.2 1.3.1 1.8-.2l8.2-4.7 0-3.1zM6 2.2c-.6-.3-1.3-.4-1.9-.2l10 8.6 0-3.2L6 2.2z" />
                </svg>
                <span>Get it on Google Play</span>
              </a>

              {/* App Store (disabled) */}
              <span
                className={[
                  "inline-flex items-center justify-center gap-3",
                  "rounded-xl px-4 py-2 text-sm font-medium",
                  "border border-light-border dark:border-dark-border",
                  "opacity-60 select-none cursor-not-allowed",
                ].join(" ")}
                title="iOS coming soon"
                aria-disabled="true"
              >
                {/* NEW: Apple logo (inline SVG) */}
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    fill="currentColor"
                    d="M16.365 12.276c-.011-1.735.782-3.046 2.384-4.007-.896-1.298-2.243-2.014-3.999-2.145-1.676-.133-3.514.976-4.16.976-.668 0-2.196-.929-3.395-.929-2.437.037-5.044 1.936-5.044 5.8 0 1.211.225 2.464.674 3.758.6 1.734 2.767 5.983 5.024 5.918 1.183-.028 2.02-.837 3.567-.837 1.523 0 2.296.837 3.604.837 2.275-.033 4.216-3.79 4.79-5.53-3.038-1.43-3.545-4.212-3.545-4.84zM14.2 4.815c1.125-1.34 1.024-2.563.992-2.815-1.143.065-2.466.787-3.228 1.733-.69.846-1.148 1.897-1.057 2.987 1.155.09 2.315-.585 3.293-1.905z"
                  />
                </svg>
                <span>App Store (soon)</span>
              </span>
            </div>

            {/* Bypass for QA/support (kept) */}
            <div className="flex items-center gap-2 text-sm">
              <Link
                href={`/allow-desktop?from=${encodeURIComponent(back || "/")}`}
                className="underline"
              >
                Just let me in
              </Link>
              <span className="text-light-subtle dark:text-dark-subtle">
                (sets a temporary cookie for this device)
              </span>
            </div>
          </div>
        </div>
      </main>
        </>

  );
}
