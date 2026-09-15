import { AlertTriangle, CircleCheck, CircleDot, CircleHelp, DatabaseZap } from "lucide-react";
import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  detail,
  info,
  children,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  info?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
        <span>{label}</span>
        {info}
      </div>
      <div className="num text-2xl font-semibold text-ink">{value}</div>
      {detail && <div className="text-sm text-ink-muted">{detail}</div>}
      {children}
    </div>
  );
}

export type ConfidenceLevel = "High" | "Medium" | "Low" | "Limited";

const CONFIDENCE_STYLE: Record<ConfidenceLevel, { className: string; Icon: typeof CircleCheck }> = {
  High: { className: "border-accent/30 bg-accent-subtle text-accent-strong", Icon: CircleCheck },
  Medium: { className: "border-line bg-paper text-ink", Icon: CircleDot },
  Low: { className: "border-band-high/30 bg-orange-50 text-band-high", Icon: CircleHelp },
  Limited: { className: "border-band-high/30 bg-orange-50 text-band-high", Icon: CircleHelp },
};

export function ConfidenceBadge({ level, prefix = "Confidence" }: { level: ConfidenceLevel; prefix?: string }) {
  const { className, Icon } = CONFIDENCE_STYLE[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon size={13} aria-hidden="true" />
      {prefix}: {level}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex gap-3 p-5">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-band-high" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium text-ink">{title}</p>
        {children && <div className="text-sm text-ink-muted">{children}</div>}
      </div>
    </div>
  );
}

export function DataUnavailable({ reason }: { reason: "unconfigured" | "unavailable" }) {
  return (
    <div className="card flex gap-3 p-5" role="status">
      <DatabaseZap size={18} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">Data is temporarily unavailable</p>
        <p className="text-sm text-ink-muted">
          {reason === "unconfigured"
            ? "The WattMap database is not configured for this deployment."
            : "WattMap could not reach its database. Please try again shortly."}
        </p>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="grid-motif border-b border-line">
      <div className="page py-10">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{title}</h1>
        {children && <div className="mt-3 max-w-3xl text-ink-muted">{children}</div>}
      </div>
    </div>
  );
}

export function Section({ id, title, description, children }: { id?: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="space-y-4">
      <div>
        <h2 id={id ? `${id}-title` : undefined} className="text-xl font-semibold">
          {title}
        </h2>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
