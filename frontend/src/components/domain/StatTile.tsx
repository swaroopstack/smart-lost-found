import { Link } from "react-router-dom";
import type { Tone } from "@/lib/constants";
import type { NavIcon } from "@/components/layout/nav";
import { cn } from "@/lib/cn";

const toneStyles: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-soft",
  brand: "bg-brand-soft text-brand-strong",
  info: "bg-info-soft text-info-strong",
  accent: "bg-accent-soft text-accent-strong",
  success: "bg-success-soft text-success-strong",
  danger: "bg-danger-soft text-danger-strong",
};

export interface StatTileProps {
  label: string;
  value: number | string;
  icon: NavIcon;
  tone?: Tone;
  hint?: string;
  to?: string;
}

export function StatTile({ label, value, icon: Icon, tone = "brand", hint, to }: StatTileProps) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-fg">{label}</p>
        <p className="mt-1.5 font-mono text-[1.6rem] font-semibold leading-none text-ink-strong">
          {value}
        </p>
        {hint && <p className="mt-1.5 text-2xs text-muted-fg">{hint}</p>}
      </div>
      <span
        className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneStyles[tone])}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="surface-card block p-4 transition-shadow duration-200 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        {body}
      </Link>
    );
  }

  return <div className="surface-card p-4">{body}</div>;
}
