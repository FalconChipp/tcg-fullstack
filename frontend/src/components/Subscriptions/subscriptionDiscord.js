// /components/Subscriptions/subscriptionDiscord.js
"use client";
import React, { useState } from "react";
import { FaDiscord, FaTimes } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

const DISCORD_INVITE = "https://discord.gg/pAnGVBb2Dc";

export default function SubscriptionDiscord({
  invite = DISCORD_INVITE,
  hideable = true,
  className = "",
}) {
  const [visible, setVisible] = useState(true);
  const dismiss = () => setVisible(false);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className={`
            relative flex flex-col md:flex-row items-center justify-between gap-4
            w-full max-w-2xl mx-auto my-14
            bg-light-surface dark:bg-dark-surface
            rounded-2xl shadow-xl
            px-6 py-6 border border-light-border dark:border-dark-border
            ring-1 ring-black/5 dark:ring-black/20
            ${className}
          `}
          style={{
            boxShadow: "0 8px 32px 0 rgba(16,22,42,0.18)",
          }}
        >
          {/* Discord logo in a surface circle */}
          <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-light-alt dark:bg-dark-alt border-2 border-light-border dark:border-dark-border shadow-inner mr-0 md:mr-5">
            <FaDiscord className="text-3xl text-[#7289da]" />
          </div>

          {/* Text block */}
          <div className="flex-1 text-center md:text-left">
            <div className="font-extrabold text-xl md:text-2xl text-light-text dark:text-dark-text">
              Questions or Need Help?
            </div>
            <div className="mt-1 text-base text-light-textSecondary dark:text-dark-textSecondary">
              Join our Discord to ask about subscriptions, billing, or your account.<br className="hidden md:inline" />
              The team and other collectors are always happy to help.
            </div>
          </div>

          {/* CTA Button */}
          <a
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
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
          >
          <FaDiscord className="text-2xl mr-1 -ml-1 text-[#f7f8fa]" />
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
              style={{
                boxShadow: "0 2px 8px 0 #21224c30"
              }}
            >
              <FaTimes className="text-lg" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
