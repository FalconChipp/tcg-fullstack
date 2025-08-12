import React from "react";

// Placeholder Marketplace & Trading settings tab
export default function MarketplaceTab({ user, token }) {
  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl px-6 py-8 shadow">
      <h2 className="text-xl font-bold mb-6 text-light-primary dark:text-dark-primary">
        Marketplace & Trading Settings
      </h2>
      <ul className="mb-4 space-y-2 text-light-text dark:text-dark-text">
        <li>• Seller profile and payout settings (coming soon)</li>
        <li>• Default shipping/payout preferences</li>
        <li>• Vacation mode toggle</li>
        <li>• Default trade rules</li>
        <li>• Manage blocked users/traders</li>
        <li>• (Future: bulk edit listings, shop analytics)</li>
      </ul>
      <div className="mt-4 text-light-textMuted dark:text-dark-textMuted">
        (Settings and tools for sellers/traders will be available after backend integration.)
      </div>
    </div>
  );
}
