import React, { useState } from "react";
import CachedImage from "@/utils/cacheImgs";

// Helper: Determine if achievement is unlocked (robust for all backends)
function isAchievementUnlocked(ach) {
  // Accepts API property, camelCase, or snake_case timestamp field
  return !!(ach.isComplete ?? ach.earnedAt ?? ach.earned_at);
}

// Helper to group by tier
const groupByTier = (achievements) => {
  const groups = {};
  for (const ach of achievements) {
    const tier = (ach.tier || "Special").toUpperCase();
    if (!groups[tier]) groups[tier] = [];
    groups[tier].push(ach);
  }
  // Order: Gold, Silver, Bronze, then others
  const order = ["GOLD", "SILVER", "BRONZE"];
  return order
    .map((t) => [t, groups[t] || []])
    .concat(
      Object.entries(groups).filter(([t]) => !order.includes(t))
    )
    .filter(([, arr]) => arr.length > 0);
};

const tierColors = {
  GOLD: "from-yellow-400 to-yellow-200 border-yellow-300",
  SILVER: "from-gray-300 to-gray-100 border-gray-400",
  BRONZE: "from-orange-400 to-orange-200 border-orange-300",
  SECRET: "from-blue-400 to-cyan-200 border-blue-400"
};

// All available tiers for filtering
const tierOptions = [
  { value: "all", label: "All Tiers" },
  { value: "GOLD", label: "Gold" },
  { value: "SILVER", label: "Silver" },
  { value: "BRONZE", label: "Bronze" },
  { value: "SECRET", label: "Secret" }
];

export default function ProfileAchievements({ achievements = [] }) {
  const [selected, setSelected] = useState(null);
  const [filterText, setFilterText] = useState("");
  const [filterUnlocked, setFilterUnlocked] = useState("unlocked"); // all, unlocked, locked
  const [filterTier, setFilterTier] = useState("all");

  if (!achievements.length) return null;

  // Apply filters
  const filtered = achievements.filter((ach) => {
    const textMatch =
      !filterText ||
      ach.title?.toLowerCase().includes(filterText.toLowerCase()) ||
      ach.description?.toLowerCase().includes(filterText.toLowerCase());
    // ------- Changed to use robust check -------------
    const unlockedMatch =
      filterUnlocked === "all" ||
      (filterUnlocked === "unlocked" && isAchievementUnlocked(ach)) ||
      (filterUnlocked === "locked" && !isAchievementUnlocked(ach));
    // ----------------------------------------------
    const tierMatch =
      filterTier === "all" ||
      (ach.tier?.toUpperCase() === filterTier) ||
      (!ach.tier && filterTier === "SECRET");
    return textMatch && unlockedMatch && tierMatch;
  });

  const groups = groupByTier(filtered);

  return (
    <div className="w-full mb-8">
      <h3 className="text-xl font-bold mb-4 text-light-accent dark:text-dark-accent">
        Achievements &amp; Badges
      </h3>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Search achievements…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="px-3 py-1 rounded border border-light-border dark:border-dark-border text-base bg-light-alt dark:bg-dark-alt focus:outline-none focus:ring-2 focus:ring-light-accent"
          style={{ minWidth: 180 }}
        />
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="px-2 py-1 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-base focus:outline-none focus:ring-2 focus:ring-light-accent"
        >
          {tierOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={filterUnlocked}
          onChange={(e) => setFilterUnlocked(e.target.value)}
          className="px-2 py-1 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-base focus:outline-none focus:ring-2 focus:ring-light-accent"
        >
          <option value="all">All</option>
          <option value="unlocked">Unlocked</option>
          <option value="locked">Locked</option>
        </select>
        {filtered.length !== achievements.length && (
          <span className="ml-2 text-xs text-light-textSecondary dark:text-dark-textSecondary">
            Showing {filtered.length} / {achievements.length}
          </span>
        )}
      </div>

      {groups.length === 0 && (
        <div className="p-6 text-center text-gray-400 dark:text-gray-500">
          No achievements match your filter.
        </div>
      )}

      {groups.map(([tier, achs]) => (
        <div key={tier} className="mb-6">
          <h4 className="mb-2 text-base font-semibold uppercase tracking-widest text-light-textSecondary dark:text-dark-textSecondary">
            {tier[0] + tier.slice(1).toLowerCase()}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {achs.map((ach) => {
              // --------- Changed everywhere that checks unlocked -----------
              console.log("ACH DATA", ach);
              const isAchieved = isAchievementUnlocked(ach);

              const showProgress =
                typeof ach.current === "number" &&
                typeof ach.goal === "number" &&
                ach.goal > 1;
              const ringColor =
                tierColors[tier] || tierColors["SPECIAL"] || "border-gray-200";

              return (
                <button
                  type="button"
                  key={ach.achievementKey}
                  onClick={() => setSelected(ach)}
                  className={`
                    group bg-white dark:bg-[#232336]
                    rounded-2xl p-2 flex flex-col items-center shadow-lg border-2
                    transition hover:scale-105 focus:scale-105 focus:z-20
                    cursor-pointer outline-none
                    ${isAchieved
                      ? `border-4 ${ringColor}`
                      : "border-light-alt dark:border-dark-alt opacity-60 grayscale"}
                  `}
                  tabIndex={0}
                  aria-label={ach.title}
                  title={ach.description || ach.title}
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-1 border-2 border-white dark:border-[#222234] overflow-hidden">
                    {ach.assetUrl ? (
                      <CachedImage
                        src={ach.assetUrl}
                        alt={ach.title}
                        className="w-full h-full object-contain"
                        style={{
                          filter: isAchieved
                            ? "none"
                            : "grayscale(90%) brightness(0.85) opacity(0.7)"
                        }}
                        cacheKey={ach.achievementKey || ach.assetUrl}
                      />
                    ) : (
                      <span className="text-3xl">🏆</span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold text-center w-full ${
                      isAchieved ? "text-light-text dark:text-dark-text" : "opacity-70"
                    }`}
                  >
                    {ach.title}
                  </span>
                  {showProgress && (
                    <div className="w-full mt-1">
                      <div className="h-2 rounded bg-light-alt dark:bg-dark-alt">
                        <div
                          className="h-2 rounded"
                          style={{
                            width: `${Math.min(
                              100,
                              ((ach.current || 0) / ach.goal) * 100
                            )}%`,
                            background: isAchieved
                              ? "linear-gradient(90deg,#C1F29C,#a7f3d0)"
                              : "linear-gradient(90deg,#adc7f3,#67c4fa)"
                          }}
                        ></div>
                      </div>
                      <span className="block text-[10px] text-center mt-0.5 opacity-70">
                        {ach.current || 0} / {ach.goal}
                      </span>
                    </div>
                  )}
                  {isAchieved && (ach.earnedAt || ach.earned_at) && (
                    <span className="block text-[10px] mt-1 opacity-60 text-center">
                      {`Unlocked: ${new Date(ach.earnedAt || ach.earned_at).toLocaleDateString()}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Modal for achievement details */}
      {selected && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-[#1c1c28] rounded-2xl shadow-2xl p-6 max-w-xs w-full relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 text-lg opacity-60 hover:opacity-100"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full mb-2 border-4 border-light-accent dark:border-dark-accent overflow-hidden">
                {selected.assetUrl ? (
                  <CachedImage
                    src={selected.assetUrl}
                    alt={selected.title}
                    className="w-full h-full object-contain"
                    style={{
                      filter: isAchievementUnlocked(selected)
                        ? "none"
                        : "grayscale(90%) brightness(0.85) opacity(0.7)"
                    }}
                    cacheKey={selected.achievementKey || selected.assetUrl}
                  />
                ) : (
                  <span className="text-4xl">🏆</span>
                )}
              </div>
              <h5 className="text-lg font-bold mb-1 text-center">
                {selected.title}
              </h5>
              <div className="text-xs text-center opacity-80 mb-2">{selected.category}</div>
              <div className="text-sm text-center mb-2">
                {selected.description || ""}
              </div>
              {selected.goal > 1 && (
                <div className="w-full">
                  <div className="h-2 rounded bg-light-alt dark:bg-dark-alt mb-1">
                    <div
                      className="h-2 rounded"
                      style={{
                        width: `${Math.min(
                          100,
                          ((selected.current || 0) / selected.goal) * 100
                        )}%`,
                        background: isAchievementUnlocked(selected)
                          ? "linear-gradient(90deg,#C1F29C,#a7f3d0)"
                          : "linear-gradient(90deg,#adc7f3,#67c4fa)"
                      }}
                    ></div>
                  </div>
                  <span className="block text-xs text-center opacity-70 mb-1">
                    {selected.current || 0} / {selected.goal}
                  </span>
                </div>
              )}
              <div className="text-xs mt-2 text-center opacity-60">
                {isAchievementUnlocked(selected)
                  ? (selected.earnedAt || selected.earned_at)
                    ? "Unlocked: " +
                      new Date(selected.earnedAt || selected.earned_at).toLocaleDateString()
                    : "Unlocked"
                  : "Not yet unlocked"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
