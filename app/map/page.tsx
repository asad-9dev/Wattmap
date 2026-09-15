import type { Metadata } from "next";
import { DataUnavailable, PageHeader } from "@/components/ui/primitives";
import { data, load } from "@/lib/data";
import { MapExplorer } from "./MapExplorer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Explore the Ontario map",
  description: "Map of Ontario schools coloured by energy intensity, peer percentile, opportunity score, or GHG intensity.",
};

export default async function MapPage() {
  const years = await load(() => data.years());
  return (
    <>
      <PageHeader eyebrow="Explore" title="Ontario school energy map">
        Schools with benchmarked energy data and official Ministry coordinates. Colour bands are relative, and every value is
        explained on the school&apos;s profile.
      </PageHeader>
      <div className="page py-8">
        {years.ok && years.data.length > 0 ? (
          <MapExplorer years={[...years.data].reverse()} defaultYear={years.data.at(-1)!} />
        ) : (
          <DataUnavailable reason={years.ok ? "unavailable" : years.reason} />
        )}
      </div>
    </>
  );
}
