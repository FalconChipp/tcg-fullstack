"use client";
import React from "react";
import ProfileShowcase from "@/components/UserProfile/ProfileShowcase";
import { FaThLarge, FaStar, FaFolderOpen, FaCoins } from "react-icons/fa";

/**
 * ProfileOverviewPanel
 * - Shows ProfileShowcase (your existing component)
 * - Displays quick profile stats (cards, binders, wishlist, collection value, etc)
 *
 * Props:
 *  - showcase: object (for ProfileShowcase)
 *  - stats: { cards, binders, wishlist, collectionValue } (numbers/strings)
 *  - isOwnProfile: bool
 *  - onEditShowcase: func (for edit button)
 *  - dark: bool
 */
export default function ProfileOverviewPanel({
  showcase,
  stats = {},
  isOwnProfile = false,
  onEditShowcase,
  dark = false,
}) {
  // Stat blocks config (uses text-accent classes)
  const statItems = [
    {
      icon: <FaThLarge className="text-vault-accent" />,
      label: "Cards",
      value: stats.cards ?? "--",
    },
    {
      icon: <FaFolderOpen className="text-vault-textSecondary dark:text-vault-textSecondary" />,
      label: "Binders",
      value: stats.binders ?? "--",
    },
    {
      icon: <FaStar className="text-yellow-400 dark:text-yellow-300" />,
      label: "Wishlist",
      value: stats.wishlist ?? "--",
    },
    {
      icon: <FaCoins className="text-green-500 dark:text-green-400" />,
      label: "Collection Value",
      value: typeof stats.collectionValue === "number"
        ? `£${stats.collectionValue.toLocaleString()}`
        : stats.collectionValue ?? "--",
    },
  ];

  return (
    <div className="w-full mb-12">
      {/* Profile Showcase (your existing shelf UI) */}
      <ProfileShowcase
        showcase={showcase}
        isOwnProfile={isOwnProfile}
        onEditShowcase={onEditShowcase}
        dark={dark}
      />

      {/* Quick Stats */}
      <div
        className={`
          w-full max-w-5xl mx-auto flex flex-col md:flex-row justify-center items-stretch
          gap-4 md:gap-8 px-2 py-5
          rounded-[10px] -inner border
          ${dark
            ? "bg-vault-surface border-vault-border"
            : "bg-vault-raised border-vault-border"}
        `}
      >
        {statItems.map((stat, i) => (
          <div
            key={i}
            className={`
              flex-1 flex flex-col items-center justify-center py-3 px-2
              rounded-[10px]
              ${dark
                ? "bg-vault-bg border border-vault-border"
                : "bg-white border border-vault-border"}
              
              min-w-[110px]
              transition
            `}
          >
            <div className="text-3xl mb-1">{stat.icon}</div>
            <div className="text-2xl font-extrabold text-vault-accent dark:text-white mb-1">
              {stat.value}
            </div>
            <div className="text-xs uppercase font-semibold tracking-wide text-vault-textTertiary">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
