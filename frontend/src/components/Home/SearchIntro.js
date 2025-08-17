// src/components/Home/SearchIntro.js
// CHANGED: align with site surfaces (alt bg + border + ring/shadow) and secondary text tone
// NEW: added className prop for external spacing overrides
export default function SearchIntro({ className = "" }) {
  return (
    <div className={`max-w-3xl mx-auto px-4 mb-4 ${className}`}>
      <div
        className="
          flex items-center justify-center gap-2
          rounded-xl
          bg-light-alt dark:bg-dark-alt
          border border-light-border dark:border-dark-border
          ring-1 ring-black/5 dark:ring-black/20
          shadow-sm
          px-4 py-2
          text-light-textSecondary dark:text-dark-textSecondary
          text-sm md:text-[15px]
        "
      >
        {/* NEW: subtle icon to match pattern used elsewhere */}
        <span aria-hidden="true" className="select-none">🔎</span>

        {/* CHANGED: single-line, scannable tip; keeps code-style example */}
        <p className="text-center">
          Search tips: try set code + number (e.g., <span className="font-mono">SVI&nbsp;210</span>) or a card name.
        </p>
      </div>
    </div>
  );
}
