"use client";

/**
 * MobileAppPromo (Homepage strip)
 *
 * - Compact, fits nicely under the hero.
 * - Uses SixByFive light/dark design tokens instead of generic zinc colors.
 * - Keeps:
 *   • Google Play link (+ UTM)
 *   • iOS "coming soon" badge
 *   • QR code with fallback generator
 * - Optional feature bullets kept but visually lighter.
 */

import { useMemo, useState } from "react";

export default function MobileAppPromo({
  appName = "SixByFive TCG",
  tagline = "Take your collection, binders, and wishlist with you on the go.",
  features = [
    "Syncs with your web account",
    "Track collection & wishlist",
    "Fast card search on mobile",
    "Built for collectors",
  ],
  androidUrl = "https://play.google.com/store/apps/details?id=com.sixbyfive.sbftcgmobile",
  iosComingSoon = true,
  qrUrl,
  webFallbackUrl = "https://tcg.sixbyfive.com",
  accentColor = "#2963FF",
  subtext = "Free to use • No ads • Syncs with your existing account",
  tinyNote = "",
  utmParams = { utm_source: "homepage", utm_medium: "cta", utm_campaign: "mobile_app" },
}) {
  // Build Play link with optional UTM params
  const playHref = useMemo(() => {
    if (!androidUrl) return "";
    try {
      const u = new URL(androidUrl);
      Object.entries(utmParams || {}).forEach(([k, v]) => v && u.searchParams.set(k, v));
      return u.toString();
    } catch {
      return androidUrl;
    }
  }, [androidUrl, utmParams]);

  // QR target
  const qrTarget = useMemo(
    () => encodeURIComponent(playHref || webFallbackUrl || ""),
    [playHref, webFallbackUrl]
  );

  // Primary + fallback QR URLs
  const primaryQr = useMemo(() => {
    if (qrUrl) return qrUrl;
    return `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chld=M|2&chl=${qrTarget}`;
  }, [qrUrl, qrTarget]);

  const secondaryQr = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${qrTarget}`,
    [qrTarget]
  );

  const [qrSrc, setQrSrc] = useState(primaryQr);
  const handleQrError = () => {
    if (qrSrc !== secondaryQr) setQrSrc(secondaryQr);
  };

  const styleVars = { "--accent": accentColor };

  return (
    <section
      style={styleVars}
      aria-label={`${appName} mobile app promotion`}
      className="
        border-y border-light-border/40 dark:border-dark-border/40
        bg-light-surfaceAlt dark:bg-dark-surfaceAlt
      "
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row md:items-center md:justify-between">
        {/* Left: text + badges */}
        <div className="w-full md:w-2/3">
          {/* Small pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-light-border/70 dark:border-dark-border/70 bg-light-surface dark:bg-dark-surface px-3 py-1 text-[11px] font-medium tracking-wide text-light-textSecondary dark:text-dark-textSecondary shadow-sm">
            <Dot className="h-2 w-2 text-[var(--accent)]" />
            <span>Android available now</span>
            {iosComingSoon && <span>• iOS coming soon</span>}
          </div>

          <h2 className="mt-3 text-xl md:text-2xl font-bold text-light-primary dark:text-dark-primary">
            {appName} mobile companion
          </h2>

          <p className="mt-2 text-sm md:text-base text-light-textSecondary dark:text-dark-textSecondary max-w-xl">
            {tagline}
          </p>

          {/* Optional feature chips */}
          {features?.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {features.map((f, i) => (
                <li
                  key={i}
                  className="
                    inline-flex items-center gap-2 rounded-full
                    bg-light-surface dark:bg-dark-surface
                    border border-light-border/60 dark:border-dark-border/60
                    px-2.5 py-1 text-[11px] text-light-textSecondary dark:text-dark-textSecondary
                  "
                >
                  <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Store badges */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {playHref ? (
              <a
                href={playHref}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-md"
                aria-label="Get it on Google Play"
              >
                <GooglePlayBadge />
              </a>
            ) : (
              <span
                aria-disabled="true"
                className="opacity-80"
                title="Google Play link not provided"
              >
                <GooglePlayBadge />
              </span>
            )}

            {iosComingSoon && (
              <span
                aria-disabled="true"
                className="opacity-60 cursor-not-allowed"
                title="iOS coming soon"
              >
                <AppStoreBadge />
              </span>
            )}
          </div>

          {/* Subtext */}
          {(subtext || tinyNote) && (
            <div className="mt-3 text-[12px] text-light-textMuted dark:text-dark-textMuted">
              {subtext && <p>{subtext}</p>}
              {tinyNote && <p className="mt-1 text-[11px]">{tinyNote}</p>}
            </div>
          )}
        </div>

        {/* Right: QR card */}
        <div className="w-full md:w-1/3 flex items-center justify-center">
          <div
            className="
              rounded-2xl p-[1px]
              bg-gradient-to-br from-[var(--accent)]/70 via-[var(--accent)]/20 to-[var(--accent)]/5
              shadow-lg
            "
          >
            <div className="rounded-2xl bg-light-surface dark:bg-dark-surface p-3">
              <div className="rounded-xl border border-light-border/70 dark:border-dark-border/70 bg-light-background dark:bg-dark-background p-2">
                <img
                  src={qrSrc}
                  alt={`QR code to open ${appName} on ${
                    playHref ? "Google Play" : "the website"
                  }`}
                  className="h-28 w-28 md:h-32 md:w-32 object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={handleQrError}
                />
              </div>
              <p className="mt-2 text-center text-[11px] text-light-textMuted dark:text-dark-textMuted max-w-[11rem]">
                Scan to open on your phone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- Inline SVG Icons ---------------------------- */

function Dot({ className }) {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={className}
    >
      <circle cx="5" cy="5" r="5" fill="currentColor" />
    </svg>
  );
}

function Check({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3A1 1 0 016.457 9.793L8.75 12.086l6.543-6.543a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* --------------------------- Inline Store Badges -------------------------- */

function AppStoreBadge({ className = "" }) {
  return (
    <span
      className={`
        inline-flex items-center rounded-xl
        border border-light-border dark:border-dark-border
        bg-light-surface dark:bg-dark-surface
        px-3 py-2 shadow-sm ${className}
      `}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" className="mr-2">
        <path
          d="M19.67 17.16c-.35.82-.76 1.58-1.24 2.27-.65.94-1.18 1.59-1.58 1.95-.63.58-1.31.88-2.03.89-.52 0-1.15-.15-1.89-.45-.74-.3-1.43-.45-2.06-.45-.66 0-1.38.15-2.16.45C7 22.93 6.43 23.08 5.99 23c-.7-.02-1.38-.34-2.05-.96-.43-.39-.98-1.06-1.64-2.03C1.6 18.85.98 17.47.67 16c-.34-1.64-.26-3.02.22-4.16.52-1.27 1.31-2.29 2.37-3.06.99-.74 2.07-1.12 3.24-1.15.64 0 1.49.17 2.54.51 1.04.34 1.71.51 2 .51.2 0 .86-.2 1.97-.58 1.05-.35 1.94-.49 2.68-.43 1.98.17 3.46.96 4.44 2.38-1.76 1.07-2.64 2.58-2.64 4.53.01 1.51.56 2.78 1.65 3.78zM16.52 0c.04 1.23-.44 2.29-1.43 3.18-.89.78-1.92 1.23-3.07 1.16-.05-1.17.43-2.23 1.39-3.12C14.3.44 15.36-.01 16.52 0z"
          fill="currentColor"
          className="text-light-foreground dark:text-dark-foreground"
        />
      </svg>
      <span className="text-left leading-tight">
        <span className="block text-[9px] text-light-textMuted dark:text-dark-textMuted">
          Download on the
        </span>
        <span className="block text-[13px] font-semibold text-light-foreground dark:text-dark-foreground">
          App Store
        </span>
      </span>
    </span>
  );
}

function GooglePlayBadge({ className = "" }) {
  return (
    <span
      className={`
        inline-flex items-center rounded-xl
        border border-light-border dark:border-dark-border
        bg-light-surface dark:bg-dark-surface
        px-3 py-2 shadow-sm ${className}
      `}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" className="mr-2">
        <path d="M3.27 2.27L13.5 12.5 3.27 22.73a2 2 0 01-.27-1.03V3.3c0-.37.09-.71.27-1.03z" fill="#34A853" />
        <path d="M14.88 13.88l2.69 2.69-11 6.35a2 2 0 01-1.54.12l9.85-9.16z" fill="#FBBC04" />
        <path d="M17.57 11.19l-2.69 2.69L3.92 2.01a2 2 0 011.54.12l12.11 7.06z" fill="#4285F4" />
        <path d="M20.63 10.06a2 2 0 010 3.88l-2.17 1.27-2.69-2.69 2.69-2.69 2.17 1.23z" fill="#EA4335" />
      </svg>
      <span className="text-left leading-tight">
        <span className="block text-[9px] text-light-textMuted dark:text-dark-textMuted">
          GET IT ON
        </span>
        <span className="block text-[13px] font-semibold text-light-foreground dark:text-dark-foreground">
          Google Play
        </span>
      </span>
    </span>
  );
}
