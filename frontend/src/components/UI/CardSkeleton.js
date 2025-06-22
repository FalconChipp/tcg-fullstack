// components/UI/CardSkeleton.js
export default function CardSkeleton({ dark = false }) {
  return (
    <div className={`
      bg-light-surface dark:bg-dark-surface
      rounded-xl shadow p-3 flex flex-col items-center min-h-[420px]
      transition-colors
    `}>
      {/* Card image skeleton */}
      <div className={`
        relative w-full aspect-[245/337]
        bg-light-alt dark:bg-dark-alt
        rounded-lg mb-2 overflow-hidden
        shimmer
      `} />
      {/* Bottom details skeleton */}
      <div className="w-full flex flex-col items-start mt-1 gap-2">
        <div className="h-6 bg-light-border dark:bg-dark-border rounded w-4/5 shimmer" />
        <div className="h-4 bg-light-border dark:bg-dark-border rounded w-1/3 shimmer" />
        <div className="h-3 bg-light-border dark:bg-dark-border rounded w-2/3 shimmer" />
        <div className="h-3 bg-light-border dark:bg-dark-border rounded w-1/3 shimmer" />
      </div>
    </div>
  );
}
