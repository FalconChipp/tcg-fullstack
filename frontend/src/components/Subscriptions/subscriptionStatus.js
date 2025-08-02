import React from "react";
import { FaLock, FaRegCheckCircle } from "react-icons/fa";

export default function SubscriptionStatus({ subscription }) {
  // Could use subscription param if/when live
  return (
    <div className="
      mx-auto max-w-xl
      mb-8
      rounded-2xl
      border-2
      border-light-border dark:border-dark-border
      bg-white/95 dark:bg-dark-surface/90
      shadow-lg
      px-6 py-8
      flex flex-col items-center
      relative
      "
    >
      {/* Badge + icon */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="
          bg-light-accent dark:bg-dark-accent
          text-white font-semibold text-xs uppercase tracking-wide
          px-4 py-1 rounded-full shadow
          flex items-center gap-2
        ">
          <FaLock className="text-sm mb-0.5" />
          Coming Soon
        </div>
      </div>

      {/* Title + plan */}
      <h2 className="mt-4 text-2xl font-extrabold text-light-accent dark:text-dark-accent text-center drop-shadow-sm">
        Free Tier
      </h2>
      <div className="flex items-center gap-2 mb-3">
        <FaRegCheckCircle className="text-green-500" />
        <span className="font-semibold text-lg text-light-text dark:text-dark-text">Active</span>
      </div>

      {/* Description */}
      <div className="text-center text-base text-light-textSecondary dark:text-dark-textSecondary max-w-md mx-auto mb-1">
        Subscriptions and upgrades are coming soon.
      </div>
      <div className="text-center text-base text-light-text dark:text-dark-text mb-2">
        <b>You have access to:</b>
      </div>
      <ul className="text-sm text-light-textSecondary dark:text-dark-textSecondary space-y-1 text-center mb-3">
        <li>✔️ Up to <b>3 digital binders</b></li>
        <li>✔️ Unlimited card collection</li>
        <li>✔️ Marketplace access (when live)</li>
        <li>✔️ Secure account &amp; all core features</li>
      </ul>
      <div className="text-xs text-light-textMuted dark:text-dark-textMuted mt-3">
        Unlock more with Collection &amp; Business plans soon!
      </div>
    </div>
  );
}
