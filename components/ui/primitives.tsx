import { AlertTriangle, CircleCheck, CircleDot, DatabaseZap } from "lucide-react";
import type { ReactNode } from "react";

/** Level-1 container: bordered white panel with an optional header bar. */
export function Panel({
  id,
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "panel-body",
}: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const headingId = id && title ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={`panel scroll-mt-20 ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-[15px] font-semibold leading-6">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 max-w-3xl text-[13px] leading-5 text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Stat card: small label, large tabular value, the unit set smaller beside it. */
export function MetricCard({
  label,
  value,
  unit,
  detail,
  info,
  emphasis = false,
  children,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  info?: ReactNode;
  emphasis?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`panel flex flex-col gap-1.5 p-4 ${emphasis ? "border-t-[3px] border-t-accent" : ""}`}>
      <div className="label flex items-center gap-1">
        <span>{label}</span>
        {info}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="num text-[26px] font-semibold leading-8 tracking-tight text-ink">{value}</span>
        {unit && <span className="text-sm text-ink-muted">{unit}</span>}
      </div>
      {detail && <div className="text-[13px] leading-5 text-ink-muted">{detail}</div>}
      {children}
    </div>
  );
}

export type ConfidenceLevel = "High" | "Medium" | "Low";

const CONFIDENCE_STYLE: Record<ConfidenceLevel, { className: string; Icon: typeof CircleCheck }> = {
  High: { className: "border-accent-line bg-accent-subtle text-accent-strong", Icon: CircleCheck },
  Medium: { className: "border-line-strong bg-canvas text-ink", Icon: CircleDot },
  Low: { className: "border-signal-high/30 bg-signal-high-wash text-signal-high", Icon: AlertTriangle },
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
    <div className="panel flex gap-3 p-5">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-signal-high" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium text-ink">{title}</p>
        {children && <div className="text-sm leading-6 text-ink-muted">{children}</div>}
      </div>
    </div>
  );
}

export function DataUnavailable({ reason }: { reason: "unconfigured" | "unavailable" }) {
  return (
    <div className="panel flex gap-3 p-5" role="status">
      <DatabaseZap size={18} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">Data is temporarily unavailable</p>
        <p className="text-sm text-ink-muted">
          {reason === "unconfigured"
            ? "The WattMap database is not configured for this deployment."
            : "WattMap could not reach its database. Refresh the page in a minute; if it persists, check the Data sources page for status."}
        </p>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="grid-motif border-b border-line bg-surface/60">
      <div className="page flex flex-wrap items-end justify-between gap-4 py-8">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
          {children && <div className="mt-2 text-[15px] leading-6 text-ink-muted">{children}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Heading + description + content, for pages that group several panels. */
export function Section({ id, title, description, children }: { id?: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="scroll-mt-20 space-y-3">
      <div>
        <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="mt-0.5 max-w-3xl text-sm leading-6 text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
