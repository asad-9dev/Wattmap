"use client";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the whole document, so
 * it cannot rely on the app's stylesheet or theme; inline styles keep it readable in any case.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-CA">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f7f6", color: "#14201a" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "4rem 1.5rem" }} role="alert">
          <h1 style={{ fontSize: 28, margin: "0 0 0.75rem" }}>WattMap could not load</h1>
          <p style={{ lineHeight: 1.6 }}>An unexpected error stopped the page from loading. Try again, or come back in a few minutes.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, minHeight: 40, padding: "0 16px", border: 0, borderRadius: 6, background: "#047857", color: "#fff", fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
