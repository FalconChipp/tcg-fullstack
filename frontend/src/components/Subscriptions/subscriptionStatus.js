import React from "react";

export default function SubscriptionStatus({ subscription, onManage }) {
  if (!subscription) return null;

  const name = subscription.plan?.name ?? "Free";
  const status = subscription.status;
  const renews = subscription.renewsAt
    ? new Date(subscription.renewsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const isCancelling = status === "canceled";

  return (
    <div className={`rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm mb-6
      ${isCancelling
        ? "border-amber-500/30 bg-amber-500/[0.06]"
        : "border-emerald-500/30 bg-emerald-500/[0.06]"}`}
    >
      <div className="flex items-center gap-2.5">
        {isCancelling ? (
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        <span className={isCancelling ? "text-amber-300" : "text-emerald-300"}>
          {isCancelling
            ? <>Your <strong>{name}</strong> plan cancels{renews ? ` on ${renews}` : " at period end"}</>
            : <>You're on the <strong>{name}</strong> plan{renews ? ` · renews ${renews}` : ""}</>}
        </span>
      </div>
      {name !== "Free" && onManage && (
        <button
          onClick={onManage}
          className="text-xs font-semibold underline underline-offset-2 text-light-textMuted dark:text-dark-textMuted hover:text-light-text dark:hover:text-dark-text transition"
        >
          Manage billing
        </button>
      )}
    </div>
  );
}
