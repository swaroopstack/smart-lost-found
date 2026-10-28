import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { MapPin, ShieldCheck } from "@phosphor-icons/react";
import type { Match, ReportSummary } from "@/api/types";
import { mediaUrl } from "@/api/client";
import { formatDateTime, formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "./CategoryIcon";
import { BandBadge, MatchStatusBadge, TypeBadge } from "./StatusBadges";
import { ScoreMeter } from "./ScoreMeter";

function OtherReport({ report }: { report: ReportSummary }) {
  const photo = mediaUrl(report.photo_url);

  return (
    <div className="flex gap-3">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CategoryIcon
              icon={report.category.icon}
              categoryKey={report.category.key}
              size={22}
              className="text-brand/40"
            />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={report.type} size="sm" />
          <span className="text-xs text-muted-fg">{report.category.label}</span>
        </div>
        <Link
          to={`/reports/${report.id}`}
          className="mt-1 block truncate text-sm font-semibold text-ink-strong hover:text-brand-strong"
        >
          {report.title}
        </Link>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-fg">
          <MapPin size={12} aria-hidden="true" />
          <span className="truncate">{report.location?.path ?? "Location not given"}</span>
        </p>
      </div>
    </div>
  );
}

export interface MatchCardProps {
  match: Match;
  perspective: "lost" | "found";
  onClaim?: (match: Match) => void;
  claimDisabledReason?: string;
  extraAction?: ReactNode;
}

export function MatchCard({ match, perspective, onClaim, claimDisabledReason, extraAction }: MatchCardProps) {
  const other = perspective === "lost" ? match.found_report : match.lost_report;
  const canClaim =
    perspective === "lost" && match.status !== "REJECTED" && Boolean(onClaim) && !claimDisabledReason;

  return (
    <article className="surface-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-semibold leading-none text-ink-strong">
            {match.score}%
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <BandBadge band={match.band} size="sm" />
            <MatchStatusBadge status={match.status} size="sm" />
          </div>
        </div>
        <span className="text-xs text-muted-fg">{formatRelative(match.created_at)}</span>
      </div>

      <ScoreMeter score={match.score} band={match.band} showLabel={false} className="mt-3" />

      <div className="mt-4 border-t border-line pt-4">
        <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-fg">
          {perspective === "lost" ? "Possible found report" : "Possible owner's report"}
        </p>
        <OtherReport report={other} />
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-fg">
          Reported {formatDateTime(other.occurred_at)}
          {other.has_hidden_detail && (
            <span className="mt-1 flex items-center gap-1 text-brand-strong">
              <ShieldCheck size={12} aria-hidden="true" />
              The reporter left a private verification detail.
            </span>
          )}
        </p>

        {canClaim ? (
          <Button size="sm" onClick={() => onClaim?.(match)}>
            This is mine
          </Button>
        ) : claimDisabledReason ? (
          <span className="text-xs font-medium text-muted-fg">{claimDisabledReason}</span>
        ) : null}
        {extraAction}
      </div>
    </article>
  );
}
