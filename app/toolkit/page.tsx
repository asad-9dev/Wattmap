import { AlertTriangle, FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SearchBox } from "@/components/search/SearchBox";
import { PageHeader, Panel } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Eco Club toolkit",
  description: "A guide for students and teachers: read your school's WattMap energy profile, ask good questions, and investigate safely.",
};

const STEPS = [
  {
    title: "Check the data confidence first",
    body: "Every profile rates its data High, Medium, or Low and lists the reasons. With Low confidence, treat the numbers as a rough starting point.",
  },
  {
    title: "Read the energy intensity",
    body: "Energy Use Intensity (GJ/m²) is the school's total energy for a year divided by its floor area, so big and small schools can be compared fairly. The kWh figure next to it is the same total energy in different units, not the electricity bill.",
  },
  {
    title: "Compare with similar schools",
    body: "The percentile shows how your school compares with schools of the same level and similar size. The 72nd percentile means higher energy intensity than 72% of those schools. That is a reason to ask questions, not proof of waste.",
  },
  {
    title: "Look at the trend",
    body: "The 3- and 5-year trends show whether energy intensity is rising or falling. The pandemic years 2020 and 2021 are left out because schools were used differently.",
  },
  {
    title: "Read the modeled gap carefully",
    body: "The gap is how much less energy the school would use at the median of its peers. It is an estimate from public data, not a promise of savings, and it is never converted to dollars.",
  },
];

const QUESTIONS = [
  "What heats our building, and what fuel does it use?",
  "Which parts of the school are used in the evenings, on weekends, or in summer (a pool, a gym, community groups)?",
  "Has the building been renovated or extended, or have portables been added or removed?",
  "How are heating, cooling, and ventilation scheduled during holidays?",
  "Are there energy projects planned, such as lighting upgrades or new controls?",
  "Could our club see monthly energy use, if the board is comfortable sharing it?",
  "What could students do that would actually help, and what should we leave to staff?",
];

const INVESTIGATIONS = [
  {
    title: "Compare with a similar school",
    body: "Use Compare to place your school next to two or three schools of the same level and size. Look at energy intensity rather than total energy.",
    href: "/compare",
    linkLabel: "Open Compare",
  },
  {
    title: "Chart your school's history",
    body: "Open your school's profile, choose View data table under Energy over time, and plot the values yourself. Mark the pandemic years and any year without a report.",
  },
  {
    title: "End-of-day switch-off check",
    body: "With a teacher, walk through empty classrooms after dismissal and record which lights, projectors, and screens were left on. Record only; switch things off only where your teacher says it is fine.",
  },
  {
    title: "Doors and windows in winter",
    body: "On a few cold days, note where exterior doors are propped open or windows are left open while the heating runs. Share the pattern with staff rather than changing anything yourself.",
  },
  {
    title: "Daylight and blinds",
    body: "Note which rooms keep lights on while blinds are closed on sunny days. It is an easy habit to talk about in a class presentation.",
  },
  {
    title: "Share what you find",
    body: "Put your findings, your questions, and the one-page WattMap report together for your principal or the school newsletter.",
  },
];

const GLOSSARY = [
  ["Energy Use Intensity (EUI)", "Total site energy per square metre of floor area, in GJ/m²."],
  ["GJ (gigajoule)", "A unit of energy. One GJ equals about 278 kWh."],
  ["ekWh/m²", "Energy intensity expressed in kWh units. It includes all fuels, not just electricity."],
  ["GHG intensity", "Greenhouse-gas emissions per square metre, in kilograms of CO₂-equivalent."],
  ["Peer group", "Schools of the same level and similar floor area, in the same reporting year."],
  ["Percentile", "The share of peer schools with lower energy intensity than yours."],
  ["Opportunity score", "A 0–100 screening indicator combining the percentile and the recent trend. Not an official rating."],
  ["Weather-normalized", "Energy adjusted to reduce the effect of unusually cold or warm years. Shown separately, only where reported."],
];

export default function ToolkitPage() {
  return (
    <>
      <PageHeader title="Eco Club toolkit">
        For students and teachers: how to read your school&apos;s energy profile, what to ask the people who run the building, and
        investigations you can do safely.
      </PageHeader>
      <div className="page space-y-4 py-8">
        <Panel id="find" title="Find your school" description="Every Ontario public school has a profile. Schools without matched energy data say so on their page.">
          <div className="max-w-xl">
            <SearchBox size="compact" />
          </div>
        </Panel>

        <Panel id="read" title="Read your school's profile in five steps" bodyClassName="p-0">
          <ol>
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4 border-b border-line px-4 py-4 last:border-0 sm:px-5">
                <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-sm font-semibold text-accent-strong" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <section aria-labelledby="safety-title" className="rounded-panel border border-signal-high/40 bg-signal-high-wash p-5">
          <div className="flex gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-signal-high" aria-hidden="true" />
            <div>
              <h2 id="safety-title" className="text-[15px] font-semibold">
                Stay safe
              </h2>
              <p className="mt-1 text-sm leading-6">Energy investigations never need anyone to touch equipment. Always work with a teacher, and:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
                <li>Never open electrical panels, outlet covers, or equipment casings.</li>
                <li>Never enter boiler, mechanical, or electrical rooms, roofs, or any area marked staff-only.</li>
                <li>Do not change thermostats, ventilation, or building controls; ask facility staff instead.</li>
                <li>No climbing, no tools, and no unplugging equipment you are not responsible for.</li>
                <li>Respect privacy: do not photograph people or record in washrooms or change rooms.</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel id="questions" title="Questions to ask your facility staff" description="Ask your teacher to set up a short conversation. Staff know things no dataset can show.">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
              {QUESTIONS.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </Panel>
          <Panel id="summary" title="Make a one-page summary">
            <div className="space-y-3 text-sm leading-6">
              <p>
                Every school profile has a <strong>Download WattMap Report</strong> button. It opens a printable page with the key numbers,
                charts, the peer comparison, data-quality notes, and sources. Use your browser&apos;s Print option and choose Save as PDF.
              </p>
              <p className="flex items-center gap-2 text-ink-muted">
                <FileDown size={16} aria-hidden="true" /> Add your questions and observations on a second page before sharing it.
              </p>
            </div>
          </Panel>
        </div>

        <Panel id="investigate" title="Investigations you can do" description="All of these use your eyes, a notebook, and WattMap. None needs access to equipment." bodyClassName="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          {INVESTIGATIONS.map((idea) => (
            <div key={idea.title} className="rounded-md border border-line p-4">
              <h3 className="font-semibold">{idea.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-ink-muted">{idea.body}</p>
              {idea.href && (
                <Link href={idea.href} className="link mt-2 inline-block text-sm">
                  {idea.linkLabel}
                </Link>
              )}
            </div>
          ))}
        </Panel>

        <Panel id="glossary" title="Words you will see">
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {GLOSSARY.map(([term, definition]) => (
              <div key={term}>
                <dt className="font-semibold">{term}</dt>
                <dd className="mt-0.5 leading-6 text-ink-muted">{definition}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-ink-muted">
            Want the formulas?{" "}
            <Link href="/methodology" className="link">
              Read the methodology
            </Link>
            . WattMap screens and benchmarks public data; it is not an energy audit.
          </p>
        </Panel>
      </div>
    </>
  );
}
