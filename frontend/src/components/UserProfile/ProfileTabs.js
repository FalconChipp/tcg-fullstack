import React from "react";

const TABS = [
  // { key: "overview", label: "Overview"},
  { key: "collection", label: "Collection" },
  { key: "wishlist", label: "Wishlist" },
  { key: "binders", label: "Binders" },
  // { key: "achievements", label: "Achievements" },
  // { key: "trades", label: "Trades" },
  { key: "listings", label: "Listings" },
  // { key: "stats", label: "Stats" },
  // { key: "customisation", label: "Customisation" }
];

export default function ProfileTabs({ activeTab, onChange }) {
  return (
    <nav
      className="
        sticky top-0 z-20 w-full bg-vault-surface mb-6
        rounded-b-2xl
        border-b border-x border-vault-border
      "
      aria-label="Profile Sections"
    >
      <ul className="flex flex-row gap-0 w-full max-w-5xl mx-auto px-2 sm:px-4">
        {TABS.map((tab) => (
          <li key={tab.key} className="flex-1">
            <button
              id={tab.key === "wishlist" ? "wishlist-tab" : undefined}
              className={`
                w-full px-0 py-3
                font-semibold text-base sm:text-lg transition
                border-b-2
                ${
                  activeTab === tab.key
                    ? "text-vault-accent border-vault-accent dark:border-vault-accent bg-vault-raised"
                    : "text-vault-textTertiary border-transparent hover:text-vault-accent dark:hover:text-vault-accent hover:bg-vault-raised/70 dark:hover:bg-vault-raised/70"
                }
                focus:outline-none
              `}
              aria-current={activeTab === tab.key ? "page" : undefined}
              onClick={() => onChange(tab.key)}
              tabIndex={0}
              type="button"
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
