"use client";
import React, { useState, useEffect } from "react"; // CHANGED: add useEffect for persisted dismiss
import { FaDiscord, FaTimes } from "react-icons/fa";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"; // CHANGED: useReducedMotion for a11y

// CHANGED: keep your default invite but allow tracking params to be appended
const DISCORD_INVITE = "https://discord.gg/PRMbMbRE2H";

export default function DiscordJoinBar({
  invite = DISCORD_INVITE,
  hideable = true,
  className = "",
  members, // NEW: optional member count like "1,243 members"
  trackParams, // NEW: optional {utm_source, utm_medium, utm_campaign}
  persistDismiss = true, // NEW: remember close across sessions
  storageKey = "sbf_discord_bar_dismissed", // NEW
  onJoin, // NEW: optional analytics callback on CTA click
  onDismiss, // NEW: optional analytics callback on dismiss
}) {
  const prefersReducedMotion = useReducedMotion(); // NEW
  const [visible, setVisible] = useState(true);

  // NEW: respect persisted dismissal
  useEffect(() => {
    if (hideable && persistDismiss) {
      try {
        const dismissed = localStorage.getItem(storageKey);
        if (dismissed === "1") setVisible(false);
      } catch (_) {
        /* no-op */
      }
    }
  }, [hideable, persistDismiss, storageKey]);

  // NEW: build invite with optional tracking params (safe fallback)
  const finalInvite = React.useMemo(() => {
    try {
      const url = new URL(invite);
      if (trackParams && typeof trackParams === "object") {
        Object.entries(trackParams).forEach(([k, v]) => {
          if (v != null) url.searchParams.set(k, String(v));
        });
      }
      return url.toString();
    } catch {
      return invite; // if relative/invalid, just return original
    }
  }, [invite, trackParams]);

  const dismiss = () => {
    setVisible(false);
    // NEW: persist & analytics hooks
    if (hideable && persistDismiss) {
      try {
        localStorage.setItem(storageKey, "1");
      } catch (_) {
        /* no-op */
      }
    }
    onDismiss?.();
  };

  const handleJoinClick = () => {
    onJoin?.();
  };

  // NEW: motion variants respect reduced motion
  const motionProps = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 },
      }
    : {
        initial: { y: 30, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: 30, opacity: 0 },
        transition: { type: "spring", stiffness: 300, damping: 32 },
      };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          {...motionProps}
          role="complementary" // NEW: a11y landmark
          aria-label="Join our Discord community"
          className={`
            relative flex flex-col md:flex-row items-center justify-between gap-4
            w-full max-w-2xl mx-auto my-10
            bg-light-surface dark:bg-dark-surface
            rounded-2xl shadow-xl
            px-6 py-5 border border-light-border dark:border-dark-border
            ring-1 ring-black/5 dark:ring-black/20
            ${className}
          `}
          style={{
            // Subtle lift
            boxShadow: "0 8px 32px 0 rgba(16,22,42,0.18)",
          }}
        >
          {/* Discord logo in a surface circle */}
          <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-light-alt dark:bg-dark-alt border-2 border-light-border dark:border-dark-border shadow-inner mr-0 md:mr-5" aria-hidden="true">
            <FaDiscord className="text-3xl text-[#7289da]" />
          </div>

          {/* Text block — CHANGED: tighter, benefit-first copy + optional members */}
          <div className="flex-1 text-center md:text-left">
            <div className="font-extrabold text-xl md:text-2xl text-light-text dark:text-dark-text">
              {/* CHANGED: stronger headline */}
              Join the community
            </div>
            <div className="mt-1 text-base text-light-textSecondary dark:text-dark-textSecondary">
              {/* CHANGED: concise, benefit-first */}
              Trade tips, get help, and see new features first.{" "}
              <span className="whitespace-nowrap">Built for UK collectors.</span>
              {members ? (
                <>
                  {" "}
                  <span className="text-light-text/80 dark:text-dark-text/80">
                    • {members}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {/* CTA Button — CHANGED: cleaner text/contrast; analytics hook */}
          <a
            href={finalInvite}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleJoinClick}
            className={`
              flex items-center gap-2
              px-6 py-3
              bg-light-accent dark:bg-dark-accent
              hover:bg-light-accentLight dark:hover:bg-dark-accentLight
              text-light-surface dark:text-dark-text
              hover:text-light-surface dark:hover:text-dark-text
              text-lg font-semibold rounded-full
              shadow-lg
              transition-all duration-150
              whitespace-nowrap
              ml-0 md:ml-5
              mt-3 md:mt-0
              focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
              border-2 border-light-accent dark:border-dark-accent
              hover:border-light-accentLight dark:hover:border-dark-accentLight
            `}
            aria-label="Join our Discord"
          >
            <FaDiscord className="text-2xl mr-1 -ml-1 text-light-surface dark:text-dark-text" aria-hidden="true" />
            <span>Join&nbsp;Discord</span>
          </a>

          {/* Dismiss button */}
          {hideable && (
            <button
              aria-label="Dismiss"
              className="
                absolute top-2 right-3 text-light-textMuted dark:text-dark-textMuted
                hover:text-light-accent dark:hover:text-dark-accent
                p-2 rounded-full
                bg-light-alt/60 dark:bg-dark-alt/60 hover:bg-light-surface/80 dark:hover:bg-dark-surface/80
                transition shadow
              "
              onClick={dismiss}
              style={{ boxShadow: "0 2px 8px 0 #21224c30" }}
            >
              <FaTimes className="text-lg" aria-hidden="true" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
