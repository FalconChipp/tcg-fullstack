import React from "react";
import Link from "next/link";

// Icon mapping based on activity type, using Tailwind palette classes
const ICONS = {
  card_added: (
    <span className="inline-flex items-center justify-center w-10 h-10 rounded-[6px] bg-orange-200 dark:bg-orange-800">
      {/* Orange-200 (light) and Orange-800 (dark) */}
      <svg width={24} height={24} fill="none" viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="4" className="fill-orange-400 dark:fill-orange-300" />
        <path d="M8 12h8M12 8v8" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      </svg>
    </span>
  ),
  trade_completed: (
    <span className="inline-flex items-center justify-center w-10 h-10 rounded-[6px] bg-blue-200 dark:bg-blue-900">
      {/* Blue-200 (light) and Blue-900 (dark) */}
      <svg width={24} height={24} fill="none" viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="4" className="fill-blue-400 dark:fill-blue-300" />
        <path d="M9 11l3 3 3-3" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      </svg>
    </span>
  ),
  achievement: (
    <span className="inline-flex items-center justify-center w-10 h-10 rounded-[6px] bg-green-200 dark:bg-green-800">
      {/* Green-200 (light) and Green-800 (dark) */}
      <svg width={24} height={24} fill="none" viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="4" className="fill-green-400 dark:fill-green-300" />
        <path d="M12 8l2.12 4.24L18 12.34l-3.44 3.36L15.88 20 12 17.24 8.12 20l.56-4.3L6 12.34l3.88-.1L12 8z" stroke="#fff" strokeWidth={1.5} />
      </svg>
    </span>
  ),
  // Add more types as needed...
};

export default function ActivityFeedItem({ activity, dark }) {
  // Choose icon or fallback
  const icon = ICONS[activity.type] || (
    <span className="inline-flex items-center justify-center w-10 h-10 rounded-[6px] bg-gray-200 dark:bg-gray-800">
      {/* gray-200/light, gray-800/dark */}
      <svg width={20} height={20} fill="none" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="10" className="fill-gray-400 dark:fill-gray-500" />
      </svg>
    </span>
  );

  return (
    <div
      className={`
        flex items-center gap-4 p-4 rounded-[10px] 
        ${dark
          ? "bg-vault-raised text-vault-text"
          : "bg-vault-surface text-vault-text"}
        transition
      `}
    >
      {/* Icon/Avatar/Badge */}
      <div>{icon}</div>
      {/* Description & Media */}
      <div className="flex-1">
        <div
          className="text-base"
          dangerouslySetInnerHTML={{ __html: activity.description }}
        />
        <div className="flex gap-2 mt-1">
          {activity.image && (
            <img src={activity.image} alt="" className="w-8 h-8 rounded " />
          )}
          {activity.avatars &&
            activity.avatars.map((av, i) => (
              <img key={i} src={av} alt="" className="w-7 h-7 rounded-[6px] border border-vault-border" />
            ))}
          {activity.badge && (
            <img src={activity.badge} alt="" className="w-8 h-8 rounded" />
          )}
        </div>
      </div>
      {/* Time & CTA */}
      <div className="flex flex-col items-end gap-1 ml-3">
        <span className="text-xs text-vault-textTertiary">{activity.time}</span>
        {activity.cta && (
          <Link
            href={activity.cta.href}
            className={`
              mt-1 px-3 py-1 rounded
              bg-vault-accent dark:bg-vault-accent
              text-white text-xs font-semibold
              hover:bg-vault-accent dark:hover:bg-vault-accent
              transition
            `}
          >
            {activity.cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}
