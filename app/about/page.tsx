import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { DISCLAIMER } from "@/lib/site";

export const metadata: Metadata = { title: "About", description: "Why WattMap exists and the principles behind it." };

const PRINCIPLES = [
  ["Accuracy over flashy features", "Only values that the source data supports are shown. Missing data stays missing."],
  ["Real data only", "Every figure comes from Ontario's published reports. Nothing is estimated to fill gaps."],
  ["Explainable", "Every metric has a formula, units, and limitations on the methodology page. No black-box models."],
  ["Honest uncertainty", "Confidence ratings, suppressed scores, and data-quality notes are shown rather than hidden."],
  ["Fair comparisons", "Schools are compared with similar schools, never ranked against the whole province."],
];

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="About" title="About WattMap">
        Public energy data is valuable only when people can understand and use it. WattMap turns Ontario&apos;s school energy reporting into
        accessible engineering insights for students, educators, researchers, and communities.
      </PageHeader>
      <div className="page grid gap-10 py-10 lg:grid-cols-[2fr_1fr]">
        <div className="prose-wm">
          <h2>What WattMap does</h2>
          <p>
            Ontario school boards report each facility&apos;s annual energy use and greenhouse-gas emissions, and the province publishes those
            reports as open data. The spreadsheets are large, change format between years, and name buildings differently from the
            Ministry&apos;s school directory. WattMap cleans them, matches facilities to schools, and presents each school&apos;s history and its
            position among comparable schools.
          </p>
          <h2>Who it is for</h2>
          <p>
            Students and school Eco Clubs curious about their building, teachers looking for real engineering data, board staff and
            researchers screening a portfolio, and anyone interested in how public buildings use energy.
          </p>
          <h2>What it is not</h2>
          <p>
            WattMap does not audit buildings, rate schools officially, or judge anyone. A higher energy intensity than comparable
            facilities is a prompt for further investigation, not a verdict. See the <Link className="link" href="/methodology">methodology</Link>{" "}
            for how every number is produced.
          </p>
          <p className="text-sm text-ink-muted">{DISCLAIMER}</p>
        </div>
        <aside aria-labelledby="principles-title" className="card h-fit p-5">
          <h2 id="principles-title" className="font-semibold">
            Principles
          </h2>
          <dl className="mt-3 space-y-3 text-sm">
            {PRINCIPLES.map(([term, description]) => (
              <div key={term}>
                <dt className="font-medium">{term}</dt>
                <dd className="text-ink-muted">{description}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </>
  );
}
