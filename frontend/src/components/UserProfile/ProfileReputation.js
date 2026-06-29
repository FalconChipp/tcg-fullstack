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
    <div className="bg-vault-surface rounded-[10px] p-5  flex flex-col mb-6 border border-vault-border">
      <h2 className="text-lg font-semibold mb-2 text-vault-accent dark:text-white">Reputation</h2>
      <div className="flex items-center gap-4">
        <span className="text-3xl font-bold text-vault-accent">{score}</span>
        <span className="px-3 py-1 bg-vault-accent text-vault-text rounded-[6px] text-xs font-semibold">
          {trustLevel}
        </span>
        {monthlyChange !== 0 && (
          <span className={`text-xs ml-2 ${monthlyChange > 0 ? "text-vault-success dark:text-vault-success" : "text-vault-danger dark:text-vault-danger"}`}>
            {monthlyChange > 0 ? `+${monthlyChange}` : monthlyChange} this month
          </span>
        )}
      </div>
      {yearlyChange !== 0 && (
        <div className={`text-xs mt-1 ${yearlyChange > 0 ? "text-vault-success dark:text-vault-success" : "text-vault-danger dark:text-vault-danger"}`}>
          {yearlyChange > 0 ? `+${yearlyChange}` : yearlyChange} this year
        </div>
      )}
      {repLog && repLog.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-vault-accent text-xs mb-2">Recent Rep Log</summary>
          <ul className="pl-3 mt-2 text-xs text-vault-textSecondary">
            {repLog.slice(0, 5).map((entry, i) => (
              <li key={i} className="mb-1">
                <span className="font-bold">{entry.amount > 0 ? "+" : ""}{entry.amount}</span>
                {entry.reason && <>: {entry.reason}</>}
                {entry.date && <span className="ml-2 text-vault-textTertiary">({entry.date})</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
