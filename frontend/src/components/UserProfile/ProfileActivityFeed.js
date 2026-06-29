import React, { useState } from "react";
import ActivityFeedItem from "./ActivityFeedItem";

// EXAMPLE: Dummy data for the feed (replace with real API data)
const mockActivityData = [
  {
    id: 1,
    type: "card_added",
    description: 'Added <b>Charizard VMAX</b> to Binder "<b>Fire Starters</b>"',
    time: "2 hours ago",
    image: "/cards/charizard-vmax.png",
    cta: { label: "View Card", href: "/card/charizard-vmax" },
  },
  {
    id: 2,
    type: "trade_completed",
    description: 'Completed a trade with <b>@MewMaster</b>',
    time: "1 day ago",
    avatars: ["/avatars/user1.png", "/avatars/user2.png"],
    cta: { label: "View Trade", href: "/trade/1234" },
  },
  {
    id: 3,
    type: "achievement",
    description: 'Unlocked achievement: <b>Marketplace Pioneer</b>',
    time: "4 days ago",
    badge: "/badges/pioneer.png",
    cta: { label: "View Achievements", href: "/profile/achievements" },
  },
];

const FILTER_OPTIONS = [
  { label: "All Activity", value: "all" },
  { label: "Trades", value: "trade_completed" },
  { label: "Listings", value: "listing" },
  { label: "Achievements", value: "achievement" },
  { label: "Collection", value: "card_added" },
];

export default function ProfileActivityFeed({ activityData = mockActivityData, dark }) {
  // Filter state
  const [filter, setFilter] = useState("all");

  // Filtered activities
  const filteredData =
    filter === "all"
      ? activityData
      : activityData.filter((item) => item.type === filter);

  return (
    <div
      className={`
        rounded-[10px]  mt-6 mb-8 p-6 w-full
        bg-vault-surface
        text-vault-text
      `}
    >
      {/* Header & Filter */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xl font-bold">
          <span className="inline-block rounded-[6px] bg-vault-accentHover/30 dark:bg-vault-accent/20 p-2">
            <svg width={22} height={22} fill="none" viewBox="0 0 24 24">
              <path d="M12 7v5l3 3"
                stroke="#a158a1"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="10"
                stroke="#a158a1"
                strokeWidth={2}
              />
            </svg>
          </span>
          Activity Feed
        </div>
        {/* Filter Dropdown */}
        <select
          className={`
            px-3 py-2 rounded-[6px] border text-sm
            bg-vault-raised
            border-vault-border
            text-vault-text
            focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent
            transition
          `}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Feed List */}
      <div className="flex flex-col gap-4">
        {filteredData.length > 0 ? (
          filteredData.map((activity) => (
            <ActivityFeedItem key={activity.id} activity={activity} dark={dark} />
          ))
        ) : (
          <div className="py-8 text-center text-vault-textTertiary">
            No recent activity.
          </div>
        )}
      </div>
    </div>
  );
}
