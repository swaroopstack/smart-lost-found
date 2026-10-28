import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/constants";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-surface-sunken text-ink-soft",
  brand: "border-brand/25 bg-brand-soft text-brand-ink",
  info: "border-info/20 bg-info-soft text-info-strong",
  accent: "border-accent/25 bg-accent-soft text-accent-strong",
  success: "border-success/20 bg-success-soft text-success-strong",
  danger: "border-danger/20 bg-danger-soft text-danger-strong",
};

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  /** Adds a small leading dot. Meaning is still carried by the label. */
  dot?: boolean;
  size?: "sm" | "md";
}

export function Badge({ tone = "neutral", children, className, dot = false, size = "md" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
