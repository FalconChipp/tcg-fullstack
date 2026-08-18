// src/components/Home/AppBanner.js
"use client";

import React, { useMemo, useState } from "react";

export default function MobileAppPromo({
  appName = "SixByFive TCG",
  tagline = "Take your collection, binders, wishlist, and card search with you.",
  features = [
    "Syncs with your web account",
    "Search cards on the go",
    "Track your collection anywhere",
    "Manage wishlist progress",
  ],
  androidUrl = "https://play.google.com/store/apps/details?id=com.sixbyfive.sbftcgmobile",
  iosComingSoon = true,
  qrUrl,
  webFallbackUrl = "https://tcg.sixbyfive.com",
  utmParams = {
    utm_source: "homepage",
    utm_medium: "cta",
    utm_campaign: "mobile_app",
  },
}) {
  const playHref = useMemo(() => {
    if (!androidUrl) return "";

    try {
      const url = new URL(androidUrl);

      Object.entries(utmParams || {}).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });

      return url.toString();
    } catch {
      return androidUrl;
    }
  }, [androidUrl, utmParams]);

  const qrTarget = useMemo(
    () => encodeURIComponent(playHref || webFallbackUrl || ""),
    [playHref, webFallbackUrl]
  );

  const primaryQr = useMemo(() => {
    if (qrUrl) return qrUrl;

    return `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chld=M|2&chl=${qrTarget}`;
  }, [qrUrl, qrTarget]);

  const fallbackQr = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${qrTarget}`,
    [qrTarget]
  );

  const [qrSrc, setQrSrc] = useState(primaryQr);

  function handleQrError() {
    if (qrSrc !== fallbackQr) {
      setQrSrc(fallbackQr);
    }
  }

  return (
    <section className="relative overflow-hidden bg-dark-background px-5 py-14 sm:px-7 lg:py-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-160px] top-10 h-[420px] w-[420px] rounded-full bg-dark-accent/10 blur-3xl" />
        <div className="absolute right-[-180px] bottom-[-180px] h-[440px] w-[440px] rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[2rem] border border-dark-border bg-dark-surface shadow-2xl shadow-black/25">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_380px]">
            {/* Left content */}
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-dark-border bg-dark-alt px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-dark-textMuted">
                <span className="h-2 w-2 rounded-full bg-dark-accentLight" />
                Android available now
                {iosComingSoon ? <span>· iOS coming soon</span> : null}
              </div>

              <h2 className="max-w-3xl text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
                Your collection, always with you.
              </h2>

              <p className="mt-4 max-w-2xl text-base leading-7 text-dark-textMuted">
                {tagline} The mobile companion is built for checking cards,
                updating progress, and keeping your collection close when you are
                away from your desk.
              </p>

              {features?.length > 0 && (
                <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {features.map((feature) => (
                    <div
                      key={feature}
                      className="rounded-2xl border border-dark-border bg-dark-alt px-4 py-3 text-sm font-bold text-dark-text"
                    >
                      <span className="mr-2 text-dark-accentLight">✓</span>
                      {feature}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {playHref ? (
                  <a
                    href={playHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-dark-accent"
                    aria-label="Get SixByFive TCG on Google Play"
                  >
                    <GooglePlayBadge />
                  </a>
                ) : (
                  <span className="opacity-70">
                    <GooglePlayBadge />
                  </span>
                )}

                {iosComingSoon && (
                  <span
                    aria-disabled="true"
                    className="cursor-not-allowed opacity-55"
                    title="iOS coming soon"
                  >
                    <AppStoreBadge />
                  </span>
                )}
              </div>

              <p className="mt-4 text-xs font-medium text-dark-textMuted">
                Free to use · No ads · Syncs with your existing SixByFive TCG
                account
              </p>
            </div>

            {/* Right QR panel */}
            <div className="flex items-center justify-center border-t border-dark-border bg-dark-alt p-6 sm:p-8 lg:border-l lg:border-t-0">
              <div className="w-full max-w-xs rounded-[1.7rem] border border-dark-border bg-dark-surface p-4 shadow-xl shadow-black/25">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-dark-textMuted">
                      Scan to download
                    </p>

                    <p className="mt-1 text-sm font-black text-dark-strong">
                      {appName}
                    </p>
                  </div>

                  <span className="rounded-full bg-dark-accent/15 px-2.5 py-1 text-xs font-black text-dark-accentLight">
                    Mobile
                  </span>
                </div>

                <div className="rounded-2xl border border-dark-border bg-white p-3">
                  <img
                    src={qrSrc}
                    alt={`QR code to open ${appName}`}
                    className="mx-auto h-44 w-44 object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={handleQrError}
                  />
                </div>

                <p className="mt-3 text-center text-xs leading-5 text-dark-textMuted">
                  Open the app listing directly from your phone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GooglePlayBadge() {
  return (
    <span className="inline-flex items-center rounded-2xl border border-dark-border bg-dark-background px-4 py-3 shadow-lg shadow-black/20">
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        className="mr-3"
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
        <span className="block text-[10px] font-bold uppercase tracking-wide text-dark-textMuted">
          Get it on
        </span>

        <span className="block text-sm font-black text-dark-strong">
          Google Play
        </span>
      </span>
    </span>
  );
}

function AppStoreBadge() {
  return (
    <span className="inline-flex items-center rounded-2xl border border-dark-border bg-dark-background px-4 py-3 shadow-lg shadow-black/20">
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        className="mr-3 text-dark-strong"
      >
        <path
          d="M19.67 17.16c-.35.82-.76 1.58-1.24 2.27-.65.94-1.18 1.59-1.58 1.95-.63.58-1.31.88-2.03.89-.52 0-1.15-.15-1.89-.45-.74-.3-1.43-.45-2.06-.45-.66 0-1.38.15-2.16.45C7 22.93 6.43 23.08 5.99 23c-.7-.02-1.38-.34-2.05-.96-.43-.39-.98-1.06-1.64-2.03C1.6 18.85.98 17.47.67 16c-.34-1.64-.26-3.02.22-4.16.52-1.27 1.31-2.29 2.37-3.06.99-.74 2.07-1.12 3.24-1.15.64 0 1.49.17 2.54.51 1.04.34 1.71.51 2 .51.2 0 .86-.2 1.97-.58 1.05-.35 1.94-.49 2.68-.43 1.98.17 3.46.96 4.44 2.38-1.76 1.07-2.64 2.58-2.64 4.53.01 1.51.56 2.78 1.65 3.78zM16.52 0c.04 1.23-.44 2.29-1.43 3.18-.89.78-1.92 1.23-3.07 1.16-.05-1.17.43-2.23 1.39-3.12C14.3.44 15.36-.01 16.52 0z"
          fill="currentColor"
        />
      </svg>

      <span className="text-left leading-tight">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-dark-textMuted">
          Coming soon on
        </span>

        <span className="block text-sm font-black text-dark-strong">
          App Store
        </span>
      </span>
    </span>
  );
}