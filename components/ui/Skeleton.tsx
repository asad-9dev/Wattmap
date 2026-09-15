/** Placeholder that reserves the space of streamed content (no layout shift when it arrives). */
export function Skeleton({ className = "", label = "Loading…" }: { className?: string; label?: string }) {
  return (
    <div role="status" aria-live="polite" className={`animate-pulse rounded-panel border border-line bg-line/40 ${className}`}>
      <span className="sr-only">{label}</span>
    </div>
  );
}
