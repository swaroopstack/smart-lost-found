import { ChartBar } from "@phosphor-icons/react";
import type { MatchBand, ScoreBreakdown as Breakdown } from "@/api/types";
import { SIGNAL_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";

const SIGNAL_ORDER = ["location", "time", "text", "attributes", "image"] as const;

function barTone(value: number): string {
  if (value >= 0.75) return "bg-brand";
  if (value >= 0.45) return "bg-accent";
  return "bg-danger/70";
}

export function ScoreBreakdown({
  breakdown,
  score,
  band,
}: {
  breakdown: Breakdown;
  score: number;
  band: MatchBand;
}) {
  const signals = breakdown.signals ?? {};
  const weights = breakdown.effective_weights ?? {};
  const hasSignals = SIGNAL_ORDER.some((name) => signals[name] !== undefined && signals[name] !== null);

  if (breakdown.reason || !hasSignals) {
    return (
      <div className="rounded-lg border border-line bg-surface-muted p-4 text-sm text-muted-fg">
        {breakdown.reason ?? "There was not enough comparable information to explain this score."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-sm text-muted-fg">
        <ChartBar size={16} className="mt-0.5 shrink-0 text-brand-strong" aria-hidden="true" />
        <p>
          Each signal is scored from 0 to 100, then blended by its weight. Signals that were missing
          from either report are dropped and the remaining weights are re-normalised.
        </p>
      </div>

      <div className="space-y-3">
        {SIGNAL_ORDER.map((name) => {
          const raw = signals[name];
          const value = typeof raw === "number" ? Math.max(0, Math.min(1, raw)) : null;
          const weight = weights[name];

          return (
            <div key={name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-ink">
                  {SIGNAL_LABELS[name]}
                  {weight !== undefined && (
                    <span className="ml-2 font-mono text-2xs font-normal text-muted-fg">
                      weight {Math.round(weight * 100)}%
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "font-mono text-sm font-semibold",
                    value === null ? "text-muted-fg" : "text-ink-strong",
                  )}
                >
                  {value === null ? "n/a" : `${Math.round(value * 100)}%`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                {value !== null && (
                  <div
                    className={cn("h-full rounded-full", barTone(value))}
                    style={{ width: `${Math.round(value * 100)}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface-muted p-3 text-sm">
        <div>
          <dt className="text-xs text-muted-fg">Weighted base</dt>
          <dd className="font-mono font-semibold text-ink">{breakdown.base_score ?? "-"}%</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-fg">Hidden-detail bonus</dt>
          <dd className="font-mono font-semibold text-ink">
            {breakdown.hidden_detail_bonus ? `+${breakdown.hidden_detail_bonus}%` : "0%"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-fg">Detail similarity</dt>
          <dd className="font-mono font-semibold text-ink">
            {typeof breakdown.hidden_detail_similarity === "number"
              ? `${Math.round(breakdown.hidden_detail_similarity * 100)}%`
              : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-fg">Final score</dt>
          <dd className="font-mono font-semibold text-brand-strong">
            {score}% <span className="text-xs font-normal text-muted-fg">({band})</span>
          </dd>
        </div>
      </dl>

      {breakdown.signals_missing && breakdown.signals_missing.length > 0 && (
        <p className="hint">
          Not available: {breakdown.signals_missing.map((name) => SIGNAL_LABELS[name] ?? name).join(", ")}.
        </p>
      )}

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-soft hover:text-ink">
          View the raw signal table
        </summary>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Signal scores and effective weights for this match</caption>
            <thead className="bg-surface-muted text-muted-fg">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Signal
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Score
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {SIGNAL_ORDER.map((name) => {
                const raw = signals[name];
                return (
                  <tr key={name}>
                    <th scope="row" className="px-3 py-2 font-normal text-ink">
                      {SIGNAL_LABELS[name]}
                    </th>
                    <td className="px-3 py-2 text-right font-mono text-ink">
                      {typeof raw === "number" ? `${Math.round(raw * 100)}%` : "not available"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-fg">
                      {weights[name] !== undefined ? `${Math.round(weights[name] * 100)}%` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
