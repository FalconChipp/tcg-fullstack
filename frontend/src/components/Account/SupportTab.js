"use client";

import React from "react";
import Link from "next/link";
import { FaDiscord } from "react-icons/fa";
import { Mail, Bug, Lightbulb } from "lucide-react";

export default function SupportTab() {
  return (
    <section className="rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-6 md:p-8 shadow">
      {/* Heading */}
      <header className="mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl font-extrabold text-light-primary dark:text-dark-primary">
          Support & Help
        </h2>
        <p className="mt-1 text-sm md:text-base text-light-textSecondary dark:text-dark-textSecondary">
          Get help fast, report issues, or request features. We usually reply within 24–48 hours.
        </p>
      </header>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <SupportCard
          icon={<FaDiscord className="w-6 h-6" />}
          iconTint="#5865F2"
          title="Join our Discord"
          description="Chat with staff and collectors. Best for quick help & feature ideas."
          cta={{
            label: "Join Discord",
            href: "https://discord.gg/PRMbMbRE2H",
            external: true,
            variant: "discord",              
            icon: <FaDiscord className="w-4 h-4" />,
          }}
          accent={{
            border: "#5865F2",
            bg: "rgba(88,101,242,0.06)",
          }}
        />

        <SupportCard
          icon={<Mail className="w-6 h-6" />}
          title="Email support"
          description="Detailed questions, account issues, or anything private."
          cta={{
            label: "support@sixbyfive.com",
            href: "mailto:support@sixbyfive.com",
            variant: "surface",
          }}
        />

        <SupportCard
          icon={<Bug className="w-6 h-6" />}
          title="Report a bug"
          description="Spotted something broken? Send details so we can squash it."
          cta={{
            label: "Send bug report",
            href: "mailto:support@sixbyfive.com?subject=Bug%20report",
            variant: "surface",
          }}
        />

        <SupportCard
          icon={<Lightbulb className="w-6 h-6" />}
          title="Request a feature"
          description="Tell us what would make SixByFive better for you."
          cta={{
            label: "Share on Discord",
            href: "https://discord.gg/PRMbMbRE2H",
            external: true,
            variant: "surface",
          }}
        />
      </div>

      {/* Footer links */}
      <div className="mt-8 space-y-2 text-sm">
        <p>
          Need quick answers? Check the{" "}
          <Link
            href="/help"
            className="text-light-accent dark:text-dark-accent underline underline-offset-2"
          >
            FAQ
          </Link>
          .
        </p>
        <p className="text-light-textSecondary dark:text-dark-textSecondary">
          Manage alerts in{" "}
          <Link
            href="/account?tab=notifications"
            className="text-light-accent dark:text-dark-accent underline underline-offset-2"
          >
            Notification preferences
          </Link>
          .
        </p>
        <p className="text-light-textMuted dark:text-dark-textMuted">
          Typical response time: <b>24–48 hours</b> (Mon–Fri).
        </p>
      </div>
    </section>
  );
}

/* =========================================================================
   SupportCard — equal-height card with pinned CTA
   ========================================================================= */
function SupportCard({ icon, iconTint, title, description, cta, accent }) {
  const style = accent
    ? { borderColor: accent.border, backgroundColor: accent.bg }
    : undefined;

  return (
    <div
      className="
        h-full rounded-xl border bg-light-alt dark:bg-dark-alt
        border-light-border dark:border-dark-border
        hover:shadow-md transition-shadow
        p-5 flex flex-col
      "
      style={style}
    >
      <div
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-light-border/60 dark:border-dark-border/60 bg-light-surface dark:bg-dark-surface"
        style={iconTint ? { color: iconTint } : undefined}
      >
        {icon}
      </div>

      <div className="mt-3">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-light-textSecondary dark:text-dark-textSecondary">
          {description}
        </p>
      </div>

      <div className="mt-auto pt-4">
        <CTA {...cta} />
      </div>
    </div>
  );
}

/* =========================================================================
   CTA — supports 'accent', 'surface', and new 'discord' variant
   ========================================================================= */
function CTA({ label, href, external, variant = "surface", icon }) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ring-offset-1 ring-offset-light-surface dark:ring-offset-dark-surface";

  const styles =
    variant === "accent"
      ? "bg-light-accent hover:bg-light-accentLight text-white dark:bg-dark-accent dark:hover:bg-dark-accentLight dark:text-white shadow"
      : variant === "discord"
      ? 
        "bg-[#5865F2] hover:bg-[#4854c1] text-white shadow"
      : // surface (neutral)
        "border border-light-border dark:border-dark-border bg-light-surface hover:bg-light-alt dark:bg-dark-surface dark:hover:bg-dark-alt text-light-text dark:text-dark-text";

  const props = {
    className: `${base} ${styles}`,
    href,
    // Inline color fallback in case a global style overrides text color
    style: variant === "discord" || variant === "accent" ? { color: "#fff" } : undefined,
  };

  const content = (
    <>
      {icon}
      <span>{label}</span>
    </>
  );

  if (external) {
    return (
      <a {...props} target="_blank" rel="noopener noreferrer" aria-label={label}>
        {content}
      </a>
    );
  }
  return (
    <a {...props} aria-label={label}>
      {content}
    </a>
  );
}
