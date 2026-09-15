"use client";

import { Info } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

/** Click/tap- and keyboard-accessible explanation. Hover alone never hides information. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        className="rounded-full p-0.5 text-ink-faint hover:text-accent"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
      >
        <Info size={15} aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute left-1/2 top-7 z-30 w-72 max-w-[80vw] -translate-x-1/2 rounded-md border border-line bg-surface p-3 text-left text-[13px] font-normal normal-case leading-5 tracking-normal text-ink shadow-lg"
        >
          <span className="mb-1 block font-semibold">{label}</span>
          {children}
        </span>
      )}
    </span>
  );
}
