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
      icon: <FaThLarge className="text-light-accent dark:text-dark-accent" />,
      label: "Cards",
      value: stats.cards ?? "--",
    },
    {
      icon: <FaFolderOpen className="text-light-secondary dark:text-dark-secondary" />,
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
          rounded-2xl shadow-inner border
          ${dark
            ? "bg-dark-surface border-dark-border"
            : "bg-light-alt border-light-border"}
        `}
      >
        {statItems.map((stat, i) => (
          <div
            key={i}
            className={`
              flex-1 flex flex-col items-center justify-center py-3 px-2
              rounded-xl
              ${dark
                ? "bg-dark-background border border-dark-border"
                : "bg-white border border-light-border"}
              shadow-sm
              min-w-[110px]
              transition
            `}
          >
            <div className="text-3xl mb-1">{stat.icon}</div>
            <div className="text-2xl font-extrabold text-light-primary dark:text-white mb-1">
              {stat.value}
            </div>
            <div className="text-xs uppercase font-semibold tracking-wide text-light-textMuted dark:text-dark-textMuted">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
