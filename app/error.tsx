"use client";

import Link from "next/link";

/** Route-level error boundary: a neutral message, never the error details or a stack trace. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page max-w-2xl space-y-4 py-20" role="alert">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="text-3xl font-semibold">This page could not be loaded</h1>
      <p className="text-ink-muted">An unexpected error occurred. You can try again, or return to the homepage.</p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong">
          Try again
        </button>
        <Link href="/" className="rounded-md border border-line px-4 py-2 text-sm text-ink no-underline">
          Homepage
        </Link>
      </div>
    </div>
  );
}
