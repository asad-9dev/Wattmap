import Link from "next/link";
import { SearchBox } from "@/components/search/SearchBox";

export default function NotFound() {
  return (
    <div className="page max-w-2xl space-y-6 py-20">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="text-ink-muted">The school or page may have moved. Try searching instead.</p>
      <SearchBox size="compact" />
      <Link href="/" className="link text-sm">
        Back to the homepage
      </Link>
    </div>
  );
}
