// src/components/Layout/DiscordBar.js
"use client";

import React, { useMemo } from "react";
import { FaDiscord } from "react-icons/fa";

const DISCORD_INVITE = "https://discord.gg/PRMbMbRE2H";

const communityPoints = [
  "Share binder builds",
  "Suggest features",
  "Report card data issues",
  "Follow marketplace updates",
];

export default function DiscordJoinBar({
  invite = DISCORD_INVITE,
  className = "",
  members,
  trackParams,
  onJoin,
}) {
  const finalInvite = useMemo(() => {
    try {
      const url = new URL(invite);

      if (trackParams && typeof trackParams === "object") {
        Object.entries(trackParams).forEach(([key, value]) => {
          if (value != null) {
            url.searchParams.set(key, String(value));
          }
        });
      }

      return url.toString();
    } catch {
      return invite;
    }
  }, [invite, trackParams]);

  function handleJoinClick() {
    onJoin?.();
  }

  return (
    <section
      aria-label="Join the SixByFive collector community"
      className={`relative overflow-hidden bg-dark-background px-5 py-20 sm:px-7 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-10 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-[#5865F2]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[2rem] border border-dark-border bg-dark-surface shadow-2xl shadow-black/25">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-[380px_1fr]">
            <div className="flex items-center justify-center border-b border-dark-border bg-dark-alt p-10 lg:border-b-0 lg:border-r">
              <div className="relative">
                <div className="absolute -inset-8 rounded-full bg-[#5865F2]/20 blur-3xl" />

                <div className="relative flex h-32 w-32 items-center justify-center rounded-[2rem] border border-dark-border bg-dark-background shadow-2xl shadow-black/30">
                  <FaDiscord className="text-6xl text-[#5865F2]" />
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 lg:p-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-dark-border bg-dark-alt px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-dark-textMuted">
                Community
                {members ? <span>· {members}</span> : null}
              </div>

              <h2 className="max-w-3xl text-3xl font-black tracking-tight text-dark-strong sm:text-4xl">
                Join the SixByFive collector community.
              </h2>

              <p className="mt-4 max-w-2xl text-base leading-7 text-dark-textMuted">
                Get help, share feedback, follow what is being built, and talk
                with other collectors as SixByFive TCG grows.
              </p>

              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {communityPoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-2xl border border-dark-border bg-dark-alt px-4 py-3 text-sm font-bold text-dark-text"
                  >
                    <span className="mr-2 text-[#8EA1FF]">#</span>
                    {point}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={finalInvite}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleJoinClick}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#5865F2] px-6 text-sm font-black text-white shadow-xl shadow-[#5865F2]/20 transition hover:bg-[#6D78FF]"
                  aria-label="Join the SixByFive Discord"
                >
                  <FaDiscord className="text-xl" />
                  Join Discord
                </a>

                <p className="text-sm text-dark-textMuted">
                  Roadmap previews, early testing, support, and community chat.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}