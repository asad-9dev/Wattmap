/**
 * Shared loading state. Used only by routes that can never return 404: a loading boundary
 * streams the page shell immediately, which fixes the HTTP status at 200 before a page could
 * call notFound().
 */
export default function LoadingSkeleton() {
  return (
    <div className="page space-y-4 py-12" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-2/3 max-w-md animate-pulse rounded bg-line" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-md bg-line/70" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-md bg-line/60" />
    </div>
  );
}
