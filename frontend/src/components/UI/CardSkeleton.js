// components/UI/CardSkeleton.js
// CHANGED: Added an overlay inside the image skeleton to display `message` (and optional CTA) on top.

export default function CardSkeleton({
  dark = false,          // unchanged (kept for parity with your API)
  message,               // NEW: optional message to overlay on the image skeleton
  actionLabel,           // NEW: optional CTA label
  onAction,              // NEW: optional CTA handler
}) {
  return (
    <div
      className={`
        bg-light-surface dark:bg-dark-surface
        rounded-xl shadow p-3 flex flex-col items-center min-h-[420px]
        transition-colors
      `}
      role="status"
      aria-label="Loading card"
      aria-live={message ? "polite" : "off"}
    >
      {/* Card image skeleton (kept). We overlay content when `message` exists. */}
      <div
        className={`
          relative w-full aspect-[245/337]
          bg-light-alt dark:bg-dark-alt
          rounded-lg mb-2 overflow-hidden
          shimmer
        `}
      >
        {/* NEW: Overlay content on top of the skeleton image area */}
        {message && (
          <div
            className={`
              absolute inset-0 flex flex-col items-center justify-center gap-2
              px-3 text-center
            `}
          >
            {/* Soft panel so shimmer still peeks through */}
            <div
              className={`
                inline-block max-w-[90%]
                rounded-md px-3 py-2
                text-sm md:text-[0.95rem]
                text-light-ink dark:text-dark-ink
                bg-light-surface/70 dark:bg-dark-surface/50
                backdrop-blur-sm
                border border-light-border/60 dark:border-dark-border/60
                whitespace-pre-line
              `}
            >
              {message}
            </div>

            {actionLabel && typeof onAction === "function" && (
              <button
                type="button"
                onClick={onAction}
                className={`
                  mt-1 inline-flex items-center justify-center
                  px-3 py-2 rounded-lg text-sm font-medium
                  bg-accent text-white hover:opacity-90
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
                `}
              >
                {actionLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom details skeleton (unchanged) */}
      <div className="w-full flex flex-col items-start mt-1 gap-2">
        <div className="h-6 bg-light-border dark:bg-dark-border rounded w-4/5 shimmer" />
        <div className="h-4 bg-light-border dark:bg-dark-border rounded w-1/3 shimmer" />
        <div className="h-3 bg-light-border dark:bg-dark-border rounded w-2/3 shimmer" />
        <div className="h-3 bg-light-border dark:bg-dark-border rounded w-1/3 shimmer" />
      </div>
    </div>
  );
}
