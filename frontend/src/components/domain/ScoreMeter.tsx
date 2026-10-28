import type { MatchBand } from "@/api/types";
import { cn } from "@/lib/cn";

const tones: Record<MatchBand, { bar: string; text: string }> = {
  HIGH: { bar: "bg-brand", text: "text-brand-strong" },
  MEDIUM: { bar: "bg-accent", text: "text-accent-strong" },
};

export function ScoreMeter({
  score,
  band,
  showLabel = true,
  className,
}: {
  score: number;
  band: MatchBand;
  showLabel?: boolean;
  className?: string;
}) {
  const tone = tones[band];
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="img"
        aria-label={`Match score ${clamped} out of 100`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", tone.bar)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn("w-10 shrink-0 text-right font-mono text-sm font-semibold", tone.text)}>
          {clamped}%
        </span>
      )}
    </div>
  );
}
