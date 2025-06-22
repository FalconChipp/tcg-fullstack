import React from "react";

/**
 * ProfileReputation: Displays user reputation score, level, and log.
 * Props:
 *   - score: number
 *   - monthlyChange: number (optional)
 *   - yearlyChange: number (optional)
 *   - trustLevel: string ("Trusted", "Standard", etc.)
 *   - repLog: array of { type, amount, reason, date } (optional)
 */
export default function ProfileReputation({
  score = 0,
  monthlyChange = 0,
  yearlyChange = 0,
  trustLevel = "Standard",
  repLog = [],
}) {
  return (
    <div className="bg-light-surface dark:bg-dark-surface rounded-xl p-5 shadow flex flex-col mb-6 border border-light-border dark:border-dark-border">
      <h2 className="text-lg font-semibold mb-2 text-light-primary dark:text-white">Reputation</h2>
      <div className="flex items-center gap-4">
        <span className="text-3xl font-bold text-light-accent dark:text-dark-accent">{score}</span>
        <span className="px-3 py-1 bg-light-accent dark:bg-dark-accent text-white rounded-full text-xs font-semibold">
          {trustLevel}
        </span>
        {monthlyChange !== 0 && (
          <span className={`text-xs ml-2 ${monthlyChange > 0 ? "text-light-success dark:text-dark-success" : "text-light-error dark:text-dark-error"}`}>
            {monthlyChange > 0 ? `+${monthlyChange}` : monthlyChange} this month
          </span>
        )}
      </div>
      {yearlyChange !== 0 && (
        <div className={`text-xs mt-1 ${yearlyChange > 0 ? "text-light-success dark:text-dark-success" : "text-light-error dark:text-dark-error"}`}>
          {yearlyChange > 0 ? `+${yearlyChange}` : yearlyChange} this year
        </div>
      )}
      {repLog && repLog.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-light-accent dark:text-dark-accent text-xs mb-2">Recent Rep Log</summary>
          <ul className="pl-3 mt-2 text-xs text-light-textSecondary dark:text-dark-textSecondary">
            {repLog.slice(0, 5).map((entry, i) => (
              <li key={i} className="mb-1">
                <span className="font-bold">{entry.amount > 0 ? "+" : ""}{entry.amount}</span>
                {entry.reason && <>: {entry.reason}</>}
                {entry.date && <span className="ml-2 text-light-textMuted dark:text-dark-textMuted">({entry.date})</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
