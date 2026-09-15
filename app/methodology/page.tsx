import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { PEER_STAGES } from "@/lib/analytics/peers";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How WattMap cleans Ontario's public energy data, matches facilities to schools, selects peers, and calculates every metric.",
};

const CONTENTS = [
  ["sources", "Data sources"],
  ["years", "Reporting years"],
  ["normalized", "Raw vs weather-normalized data"],
  ["cleaning", "Data cleaning"],
  ["matching", "School and facility matching"],
  ["eui", "Energy Use Intensity"],
  ["intensities", "GHG, electricity, and gas intensity"],
  ["peers", "Peer selection"],
  ["percentiles", "Percentiles"],
  ["score", "Energy Opportunity Score"],
  ["gap", "Theoretical gap to the peer median"],
  ["anomalies", "Anomaly screening"],
  ["confidence", "Confidence ratings"],
  ["pandemic", "Pandemic-period caveat"],
  ["limitations", "Limitations"],
  ["audit", "Why WattMap is not an energy audit"],
] as const;

export default function MethodologyPage() {
  return (
    <>
      <PageHeader eyebrow="Methodology" title="How WattMap works">
        Every number on WattMap comes from a documented calculation on public data. This page explains each step, with formulas and
        units, in plain language. The calculations live in tested, pure functions in the open source code (lib/analytics).
      </PageHeader>
      <div className="page grid gap-10 py-10 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="On this page" className="h-fit text-sm lg:sticky lg:top-20">
          <p className="mb-2 font-medium">On this page</p>
          <ol className="space-y-1.5">
            {CONTENTS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-ink-muted no-underline hover:text-accent-strong">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* min-w-0: a grid child otherwise grows to its widest formula line and overflows on phones. */}
        <div className="prose-wm min-w-0">
          <h2 id="sources">Data sources</h2>
          <p>
            Energy and emissions come from the Government of Ontario&apos;s <em>Energy use and greenhouse gas emissions for the Broader
            Public Sector</em> reports, published yearly on the Ontario Data Catalogue. Every school board reports each of its facilities:
            schools, administrative buildings, and other sites. School names, boards, addresses, and levels come from the Ministry of
            Education&apos;s <em>Ontario public school contact information</em>. Map coordinates come from the Ministry&apos;s <em>School
            information and student demographics</em> file; WattMap reads only its school number, latitude, and longitude and ignores every
            student-related column. See <Link className="link" href="/data">Data sources</Link> for files, years, and licences.
          </p>

          <h2 id="years">Reporting years</h2>
          <p>
            WattMap uses each file&apos;s own reporting year. From 2021 onward the files state the period explicitly: school boards report on
            a school-year basis, so &ldquo;2021&rdquo; covers 1 September 2021 to 31 August 2022. Files for 2011–2020 do not state the period.
            The 2024 file published so far contains no school-board records, so 2023 is the latest school-board year.
          </p>

          <h2 id="normalized">Raw vs weather-normalized data</h2>
          <p>
            Weather-normalized energy adjusts reported consumption to reduce the effect of differences in weather conditions between years.
            WattMap&apos;s charts, benchmarks, and scores use <strong>raw reported site energy</strong>, because it is the only measure available
            consistently for every year. Weather-normalized site energy is shown as its own series only where a file reports it (2021
            onward, and not for every facility), and never joined to raw values in one line.
          </p>
          <p>
            The ministry also publishes a separate 2011–2020 normalized workbook for school boards, expressed as energy per heating degree
            day per square foot (eWh/HDD/ft²). Its methodology was revised during that period and its units are not comparable with GJ, so
            WattMap documents it but does not use it.
          </p>

          <h2 id="cleaning">Data cleaning</h2>
          <p>
            The yearly files come in three layouts (2011–2015, 2016–2020, 2021 onward) with different column names, header rows, and unit
            labels, including French unit names. WattMap maps each layout onto one schema by column name, never by column position, and keeps
            the untouched source row for every record so any value can be traced back.
          </p>
          <ul>
            <li>
              <strong>Only exact conversions are applied</strong>: square feet to m² (× 0.09290304), kWh to GJ (× 0.0036), MWh to kWh, and
              tonnes to kilograms. Natural gas in cubic metres and fuel oil in litres are <em>not</em> converted to GJ, because that would
              need an assumed heating value.
            </li>
            <li>
              <strong>Total energy for 2011–2020</strong> is not published directly. Those files publish the ministry&apos;s energy intensity
              in GJ/m², so WattMap recovers the total as <code>intensity × floor area</code>; such totals are flagged as derived.
            </li>
            <li>
              Records are flagged, not deleted, for missing or non-positive floor area, missing total energy, negative energy, unrecognized
              units, and duplicate facility-years. Flagged records stay visible on their own profile but are excluded from every peer group.
            </li>
            <li>
              <strong>Plausibility bounds.</strong> A few source rows contain values no school building can have — for example 2013
              rows reporting about 600,000 GJ/m², floor areas entered roughly ten times too large, or zero energy for an occupied floor area.
              Records with an EUI outside <code>0.05–5 GJ/m²</code> or a GHG intensity above <code>500 kg CO₂e/m²</code> are flagged as
              implausible. The bounds come from the observed data (median EUI ≈ 0.6 GJ/m², 99.9th percentile ≈ 5; median GHG intensity ≈
              25 kg CO₂e/m²). Implausible records are shown as published but excluded from peer groups, scores, and provincial and board
              totals, and the number excluded is stated wherever totals appear.
            </li>
          </ul>

          <h2 id="matching">School and facility matching</h2>
          <p>
            Energy files name facilities the way each board reports them (&ldquo;Ben R McMullin PS&rdquo;), which is often not the
            Ministry&apos;s name for the school. WattMap first resolves the reporting organization to a Ministry board (handling abbreviations,
            word order, and board renames), then tries these steps in order, stopping at the first that finds candidates:
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>A manually verified override.</li>
            <li>Exact normalized name within the same board (confidence 1.00).</li>
            <li>Same normalized street address and city within the board (0.95).</li>
            <li>Near-identical name in the same city and board: similarity ≥ 0.90 and clearly ahead of the runner-up (0.85).</li>
            <li>Loose similarity within the board — <strong>never accepted automatically</strong>; candidates go to human review.</li>
          </ol>
          <p>
            Normalization folds accents, punctuation, and capitalization, and expands abbreviations such as S.S., P.S., C.I., and É.S. A step
            that finds more than one school marks the facility ambiguous rather than guessing. Unmatched and ambiguous facilities are listed
            for review, and verified decisions are stored so they survive future ingestions. A school&apos;s history combines every facility
            matched to it, which keeps it continuous when the reported name changes.
          </p>

          <h2 id="eui">Energy Use Intensity</h2>
          <code className="formula">EUI (GJ/m²) = total site energy (GJ) ÷ floor area (m²)</code>
          <p>
            EUI is calculated only when total energy is valid and floor area is positive. For readers used to kWh, WattMap also shows the
            energy-equivalent value: <code>EUI (ekWh/m²) = EUI (GJ/m²) × 277.78</code>, since 1 GJ = 277.78 kWh. This expresses
            <em> total</em> energy in kWh units; it is not electricity consumption.
          </p>

          <h2 id="intensities">GHG, electricity, and gas intensity</h2>
          <code className="formula">{`GHG intensity (kg CO₂e/m²)       = reported GHG emissions (kg CO₂e) ÷ floor area (m²)
Electricity intensity (kWh/m²)   = electricity (kWh) ÷ floor area (m²)
Natural gas intensity (GJ/m²)    = natural gas as reported in GJ ÷ floor area (m²)`}</code>

          <h2 id="peers">Peer selection</h2>
          <p>
            A school is never compared with every building in Ontario. Its peers are facilities in the same reporting year with the same
            operation type (school buildings) and the same school level (elementary, secondary, or combined), filtered further by size:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="sr-only">Peer selection stages</caption>
              <thead>
                <tr className="border-b border-line text-xs uppercase text-ink-muted">
                  <th scope="col" className="py-2 pr-4">Stage</th>
                  <th scope="col" className="py-2">Additional criteria</th>
                </tr>
              </thead>
              <tbody>
                {PEER_STAGES.map((stage, i) => (
                  <tr key={stage.label} className="border-b border-line/70">
                    <td className="num py-2 pr-4">{i + 1}</td>
                    <td className="py-2">{stage.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            WattMap uses the first stage with at least <strong>20</strong> peers. If no stage reaches 20, it uses the most specific stage with
            at least <strong>10</strong>. With fewer than 10 comparable facilities, no percentile or score is shown: &ldquo;Insufficient
            comparable facilities for a reliable peer benchmark.&rdquo;
          </p>

          <h2 id="percentiles">Percentiles</h2>
          <code className="formula">percentile = 100 × (peers with lower EUI + ½ × peers with equal EUI) ÷ number of peers</code>
          <p>
            A higher percentile means <strong>higher</strong> energy use per m². A school at the 80th percentile uses more energy per square
            metre than about 80% of its peers — it is not &ldquo;in the top 20%&rdquo; of performers. Ties count half, so identical values always
            share the same percentile.
          </p>

          <h2 id="score">Energy Opportunity Score</h2>
          <p>
            The score (0–100) estimates how strongly the public data suggests there may be an opportunity for further energy investigation
            relative to peers. It is an independent benchmarking indicator, <strong>not</strong> an official Ontario rating.
          </p>
          <code className="formula">{`P            = EUI percentile ÷ 100
trend_factor = clamp((annual EUI trend % + 10) ÷ 20, 0, 1)
score        = round(100 × (0.80 × P + 0.20 × trend_factor))`}</code>
          <p>
            The annual trend is a least-squares fit of EUI over the most recent 3–5 valid, non-pandemic reporting years, divided by their
            mean. A trend of −10%/yr or better gives 0, a flat trend 0.5, and +10%/yr or worse 1. Without three usable years the score uses
            the percentile alone and its confidence is lowered.
          </p>
          <p>
            <strong>Score confidence</strong> (High, Medium, Low) reflects peer-group size (20+ preferred), whether a trend was available,
            match quality, and missing fields. The score is <strong>suppressed</strong> entirely when there are fewer than 10 peers or when the
            underlying record has a data problem (negative energy, unrecognized units, a duplicate record, or non-positive floor area).
          </p>

          <h2 id="gap">Theoretical gap to the peer median</h2>
          <code className="formula">{`energy_gap (GJ) = (EUI − peer median EUI) × floor area    if EUI > peer median
energy_gap (GJ) = 0                                       otherwise`}</code>
          <p>
            Read this as: &ldquo;If this facility&apos;s energy intensity matched the current median of comparable facilities, the model
            suggests annual site-energy use would be approximately this much lower.&rdquo; It is a benchmarking estimate, not an engineering
            audit or a guaranteed saving. WattMap does not convert it to dollars: fuel mix, prices, and tariffs vary too much to do so
            defensibly.
          </p>

          <h2 id="anomalies">Anomaly screening</h2>
          <code className="formula">robust z = 0.6745 × (EUI − peer median) ÷ MAD</code>
          <p>
            MAD is the median absolute deviation of the peer group. If MAD is zero (more than half the peers share one value), the mean
            absolute deviation is used instead, as in Iglewicz and Hoaglin&apos;s modified z-score. Labels: <em>typical peer range</em> (z &lt; 2),{" "}
            <em>elevated relative to peers</em> (2 ≤ z &lt; 3.5), <em>unusually high relative to peers</em> (z ≥ 3.5). Screening needs at least
            10 peers. Separately, a change of more than 30% between consecutive reporting years is flagged for review; gaps between
            non-consecutive years are never treated as one change.
          </p>

          <h2 id="confidence">Confidence ratings</h2>
          <p>Each profile shows <strong>Data confidence: High, Medium, or Limited</strong>, always with its reasons:</p>
          <ul>
            <li>
              <strong>Limited</strong>: no confident facility match, missing floor area or total energy, a negative value, unrecognized units,
              or fewer than 10 peers.
            </li>
            <li>
              <strong>Medium</strong>: a similarity-based match, 10–19 peers, fewer than three years, a duplicate source record, or a
              year-over-year change above 30%.
            </li>
            <li>
              <strong>High</strong>: none of the above. Informational notes (derived totals, combined facilities, no coordinates) do not lower
              confidence.
            </li>
          </ul>

          <h2 id="pandemic">Pandemic-period caveat</h2>
          <p>
            School buildings operated abnormally during the COVID-19 pandemic. The 2020 and 2021 reporting years are shaded on every chart,
            excluded from trend fits, and noted in year-over-year comparisons. Because the pre-2021 files do not state their reporting period,
            earlier years may also include part of the disruption.
          </p>

          <h2 id="limitations">Limitations</h2>
          <ul>
            <li>Public data describes how much energy a building used, not why. Age, systems, occupancy, pools, and portables all matter.</li>
            <li>Floor area and operating hours are self-reported and occasionally inconsistent between years.</li>
            <li>Facility names changed between layouts; some schools cannot be matched with confidence and show no energy data.</li>
            <li>Schools that closed before 2026 are not in the current Ministry directory, so their facilities remain unmatched.</li>
            <li>Totals for 2011–2020 depend on the ministry&apos;s own conversion factors, which are not published in the files.</li>
          </ul>

          <h2 id="audit">Why WattMap is not an energy audit</h2>
          <p>
            An energy audit examines a building in person: its envelope, mechanical systems, controls, and schedules. WattMap only screens
            and benchmarks publicly reported annual totals. A high percentile is a reason to ask questions, not a finding that a school is
            wasteful or inefficient. WattMap is independent and is not affiliated with or endorsed by the Government of Ontario or any school
            board.
          </p>
        </div>
      </div>
    </>
  );
}
