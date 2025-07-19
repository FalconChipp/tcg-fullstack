import React, { useState } from "react";

// --- Helper: Unwrap achievement data for API UserAchievement or flat Achievement ---
function extractAchievement(ach) {
  return ach && ach.achievement ? ach.achievement : ach;
}

function isAchievementUnlocked(ach) {
  return !!(ach.isComplete ?? ach.earnedAt ?? ach.earned_at);
}

function parseAchievementDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "string" && /^\d+$/.test(val)) return new Date(Number(val));
  if (typeof val === "number") return new Date(val);
  return new Date(val);
}

function getAchievementImageUrl(ach) {
  const a = extractAchievement(ach);
  return a.iconUrl || a.imageUrl || a.assetUrl || null;
}

function getAchievementName(ach) {
  const a = extractAchievement(ach);
  return a.name || a.title || a.code || "Achievement";
}

function getAchievementDescription(ach) {
  const a = extractAchievement(ach);
  return a.description || "";
}

function getAchievementTier(ach) {
  const a = extractAchievement(ach);
  return (a.tier || "Special").toUpperCase();
}

const groupByTier = (achievements) => {
  const groups = {};
  for (const ach of achievements) {
    const tier = getAchievementTier(ach);
    if (!groups[tier]) groups[tier] = [];
    groups[tier].push(ach);
  }
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
  SECRET: "from-blue-400 to-cyan-200 border-blue-400",
  SPECIAL: "from-purple-400 to-purple-100 border-purple-300"
};

const tierOptions = [
  { value: "all", label: "All Tiers" },
  { value: "GOLD", label: "Gold" },
  { value: "SILVER", label: "Silver" },
  { value: "BRONZE", label: "Bronze" },
  { value: "SECRET", label: "Secret" }
];

// --- How many skeletons to show for coming soon, per tier
const SKELETONS_PER_TIER = 5;

function AchievementSkeleton() {
  return (
    <div
      className={`
        group bg-white dark:bg-[#232336]
        rounded-2xl p-2 flex flex-col items-center shadow-lg border-2 border-dashed border-gray-400
        opacity-60 grayscale cursor-not-allowed relative
        min-h-[160px]
      `}
      tabIndex={-1}
      aria-disabled="true"
      style={{ pointerEvents: "none" }}
    >
      <div className="w-28 h-28 rounded-full flex items-center justify-center mb-1 border-2 border-gray-300 bg-light-alt dark:bg-dark-alt">
        <span className="text-4xl opacity-50">?</span>
      </div>
      <span className="text-xs font-semibold text-center w-full text-gray-400 mt-1">
        Coming Soon
      </span>
      <span className="text-[10px] text-center mt-1 opacity-50">
        More achievements arriving soon!
      </span>
    </div>
  );
}

export default function ProfileAchievements({ achievements = [] }) {
  const [selected, setSelected] = useState(null);
  const [filterText, setFilterText] = useState("");
  const [filterUnlocked, setFilterUnlocked] = useState("unlocked");
  const [filterTier, setFilterTier] = useState("all");

  if (!achievements.length) return null;

  // --- Apply filters (using unwrapped data) ---
  const filtered = achievements.filter((ach) => {
    const a = extractAchievement(ach);
    const textMatch =
      !filterText ||
      getAchievementName(a).toLowerCase().includes(filterText.toLowerCase()) ||
      getAchievementDescription(a).toLowerCase().includes(filterText.toLowerCase());
    const unlockedMatch =
      filterUnlocked === "all" ||
      (filterUnlocked === "unlocked" && isAchievementUnlocked(ach)) ||
      (filterUnlocked === "locked" && !isAchievementUnlocked(ach));
    const tierMatch =
      filterTier === "all" ||
      (getAchievementTier(a) === filterTier) ||
      (!a.tier && filterTier === "SECRET");
    return textMatch && unlockedMatch && tierMatch;
  });

  const groups = groupByTier(filtered);

  // Check if at least one skeleton should be shown (if you want, you can hide them when all possible achievements are shown)
  const anySkeletons = groups.length > 0;

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
              const achievement = extractAchievement(ach);
              const isAchieved = isAchievementUnlocked(ach);
              const showProgress =
                typeof ach.current === "number" &&
                typeof ach.goal === "number" &&
                ach.goal > 1;
              const ringColor =
                tierColors[getAchievementTier(achievement)] || tierColors["SPECIAL"] || "border-gray-200";
              const unlockedDate = isAchieved
                ? parseAchievementDate(ach.earnedAt || ach.earned_at)
                : null;
              const name = getAchievementName(achievement);
              const imgUrl = getAchievementImageUrl(achievement);
              const desc = getAchievementDescription(achievement);

              return (
                <button
                  type="button"
                  key={ach.achievementKey || achievement.code || achievement.id}
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
                  aria-label={name}
                  title={desc || name}
                >
                  <div className="w-28 h-28 rounded-full flex items-center justify-center mb-1 border-2 border-white dark:border-[#222234] overflow-hidden">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={name}
                        className="w-full h-full object-contain"
                        style={{
                          maxWidth: "120px",
                          maxHeight: "120px",
                          minWidth: "120px",
                          minHeight: "120px",
                          filter: isAchieved
                            ? "none"
                            : "grayscale(90%) brightness(0.85) opacity(0.7)"
                        }}
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
                    {name}
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
                  {isAchieved && unlockedDate && (
                    <span className="block text-[10px] mt-1 opacity-60 text-center">
                      {`Unlocked: ${unlockedDate.toLocaleDateString()}`}
                    </span>
                  )}
                </button>
              );
            })}
            {/* --- Skeletons: visually hint more are coming --- */}
            {[...Array(SKELETONS_PER_TIER)].map((_, i) => (
              <AchievementSkeleton key={`skeleton-${tier}-${i}`} />
            ))}
          </div>
        </div>
      ))}

      {/* "More coming soon" note if any skeletons are shown */}
      {anySkeletons && (
        <div className="mt-8 text-center text-gray-400 dark:text-gray-500 text-base italic">
          More achievements coming soon!
        </div>
      )}

      {/* Modal for achievement details */}
      {selected && (() => {
        const achievement = extractAchievement(selected);
        const name = getAchievementName(achievement);
        const imgUrl = getAchievementImageUrl(achievement);
        const desc = getAchievementDescription(achievement);
        return (
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
                <div className="w-28 h-28 rounded-full mb-2 border-4 border-light-accent dark:border-dark-accent overflow-hidden flex items-center justify-center bg-light-surface dark:bg-dark-surface">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={name}
                      className="object-contain"
                      style={{
                        width: "120px",
                        height: "120px",
                        filter: isAchievementUnlocked(selected)
                          ? "none"
                          : "grayscale(90%) brightness(0.85) opacity(0.7)",
                      }}
                    />
                  ) : (
                    <span className="text-4xl">🏆</span>
                  )}
                </div>
                <h5 className="text-lg font-bold mb-1 text-center">
                  {name}
                </h5>
                <div className="text-xs text-center opacity-80 mb-2">{achievement.category}</div>
                <div className="text-sm text-center mb-2">
                  {desc}
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
                    ? (() => {
                        const date = parseAchievementDate(selected.earnedAt || selected.earned_at);
                        return date ? "Unlocked: " + date.toLocaleDateString() : "Unlocked";
                      })()
                    : "Not yet unlocked"}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
