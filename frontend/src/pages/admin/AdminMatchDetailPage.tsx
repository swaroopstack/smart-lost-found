import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarBlank,
  CheckCircle,
  LockSimple,
  MapPin,
  ShieldCheck,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { errorMessage } from "@/api/errors";
import { mediaUrl } from "@/api/client";
import type { Report, ScoreBreakdown as Breakdown } from "@/api/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { ScoreBreakdown } from "@/components/domain/ScoreBreakdown";
import { ScoreMeter } from "@/components/domain/ScoreMeter";
import { BandBadge, MatchStatusBadge, ReportStatusBadge, TypeBadge } from "@/components/domain/StatusBadges";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function ReportPanel({
  report,
  label,
  fieldLabels,
}: {
  report: Report;
  label: string;
  fieldLabels?: Map<string, string>;
}) {
  const photo = mediaUrl(report.photo_url);
  const attributes = Object.entries(report.attributes ?? {});
  const hidden = Object.entries(report.hidden_attributes ?? {});
  const labelFor = (key: string) => fieldLabels?.get(key) ?? humanize(key);

  return (
    <article className="surface-card flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-line bg-surface-muted px-4 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-fg">{label}</h3>
        <TypeBadge type={report.type} size="sm" />
      </header>

      {photo ? (
        <img
          src={photo}
          alt={`Photo attached to ${report.title}`}
          className="max-h-60 w-full bg-surface-sunken object-contain"
        />
      ) : (
        <div className="flex h-24 items-center justify-center bg-surface-sunken text-xs text-muted-fg">
          No photo attached
        </div>
      )}

      <div className="flex-1 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <ReportStatusBadge status={report.status} size="sm" />
          <Badge tone="neutral" size="sm">
            {report.category.label}
          </Badge>
        </div>

        <h4 className="mt-2 text-sm font-semibold text-ink-strong">{report.title}</h4>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-fg">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} aria-hidden="true" />
            {report.location?.path ?? "No location"}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarBlank size={12} aria-hidden="true" />
            {formatDateTime(report.occurred_at)}
          </span>
        </div>

        {report.public_description && (
          <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-ink-soft">
            {report.public_description}
          </p>
        )}

        {attributes.length > 0 && (
          <dl className="mt-3 space-y-1.5 border-t border-line pt-3">
            {attributes.map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-3 text-xs">
                <dt className="text-muted-fg">{labelFor(key)}</dt>
                <dd className="max-w-[60%] break-words text-right font-medium text-ink">
                  {displayValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {hidden.length > 0 && (
          <div className="mt-3 rounded-lg border border-accent/25 bg-accent-soft/40 p-2.5">
            <p className="flex items-center gap-1 text-xs font-semibold text-accent-strong">
              <LockSimple size={12} aria-hidden="true" />
              Private detail (staff only)
            </p>
            <dl className="mt-1.5 space-y-1">
              {hidden.map(([key, value]) => (
                <div key={key} className="flex items-start justify-between gap-3 text-xs">
                  <dt className="text-muted-fg">{labelFor(key)}</dt>
                  <dd className="max-w-[60%] break-words text-right font-medium text-ink">
                    {displayValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {report.deposited_location && (
          <p className="mt-3 text-xs text-muted-fg">
            Handed in at{" "}
            <span className="font-medium text-ink">{report.deposited_location.path}</span>
          </p>
        )}

        {report.has_hidden_detail && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-brand/20 bg-brand-soft/40 px-3 py-2 text-xs leading-relaxed text-brand-ink">
            <ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            A private verification detail is on file. It is never displayed; judge the claim answer
            against the item in hand and the details shown here.
          </p>
        )}

        <div className="mt-3 border-t border-line pt-3">
          <Link
            to={`/reports/${report.id}`}
            className="text-xs font-semibold text-brand-strong hover:underline"
          >
            Open the full report
          </Link>
        </div>
      </div>
    </article>
  );
}

export function AdminMatchDetailPage() {
  const { id } = useParams();
  const matchId = Number(id);
  const isValidId = Number.isInteger(matchId) && matchId > 0;

  const toast = useToast();
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState<"confirm" | "reject" | null>(null);
  const [note, setNote] = useState("");

  const matchQuery = useQuery({
    queryKey: ["admin", "match", matchId],
    queryFn: () => endpoints.adminMatch(matchId),
    enabled: isValidId,
  });

  const match = matchQuery.data;

  const lostQuery = useQuery({
    queryKey: ["report", match?.lost_report.id],
    queryFn: () => endpoints.report(match!.lost_report.id),
    enabled: Boolean(match),
  });

  const foundQuery = useQuery({
    queryKey: ["report", match?.found_report.id],
    queryFn: () => endpoints.report(match!.found_report.id),
    enabled: Boolean(match),
  });

  const lostFieldsQuery = useQuery({
    queryKey: ["category-fields", lostQuery.data?.category.key],
    queryFn: () => endpoints.categoryFields(lostQuery.data!.category.key),
    enabled: Boolean(lostQuery.data),
    staleTime: 10 * 60_000,
  });

  const foundFieldsQuery = useQuery({
    queryKey: ["category-fields", foundQuery.data?.category.key],
    queryFn: () => endpoints.categoryFields(foundQuery.data!.category.key),
    enabled: Boolean(foundQuery.data),
    staleTime: 10 * 60_000,
  });

  const decisionMutation = useMutation({
    mutationFn: ({ kind, noteText }: { kind: "confirm" | "reject"; noteText?: string }) =>
      kind === "confirm"
        ? endpoints.confirmMatch(matchId, noteText)
        : endpoints.rejectMatch(matchId, noteText),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["admin", "match", matchId], data);
      queryClient.invalidateQueries({ queryKey: ["admin", "matches"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success(
        variables.kind === "confirm" ? "Match confirmed" : "Match rejected",
        variables.kind === "confirm"
          ? "The owner can now submit a claim. Staff still approve the release."
          : "Both reports stay open and will keep matching independently.",
      );
      setDecision(null);
      setNote("");
    },
    onError: (error) => toast.error("Could not save the decision", errorMessage(error)),
  });

  if (!isValidId) {
    return (
      <EmptyState
        icon={<WarningCircle size={22} aria-hidden="true" />}
        title="That match link is not valid"
        description="Open the match queue to pick a suggestion."
        action={
          <Link to="/admin/matches" className={buttonStyles("primary", "sm")}>
            Back to the queue
          </Link>
        }
      />
    );
  }

  if (matchQuery.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <div className="surface-card p-5">
          <SkeletonText lines={3} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (matchQuery.isError || !match) {
    return (
      <EmptyState
        icon={<WarningCircle size={22} aria-hidden="true" />}
        title="We could not load this match"
        description={errorMessage(matchQuery.error)}
        action={
          <Link to="/admin/matches" className={buttonStyles("primary", "sm")}>
            Back to the queue
          </Link>
        }
      />
    );
  }

  const breakdown = (match.score_breakdown ?? {}) as unknown as Breakdown;
  const pending = match.status === "SUGGESTED";
  const lostLabels = new Map(
    (lostFieldsQuery.data ?? []).map((field) => [field.key, field.label]),
  );
  const foundLabels = new Map(
    (foundFieldsQuery.data ?? []).map((field) => [field.key, field.label]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Desk dashboard", to: "/admin" },
          { label: "Match queue", to: "/admin/matches" },
          { label: `Match #${match.id}` },
        ]}
        title={`Match #${match.id}`}
        description={`Suggested ${formatRelative(match.created_at)} · ${match.lost_report.title} ↔ ${match.found_report.title}`}
        actions={
          <Link to="/admin/matches" className={buttonStyles("secondary", "md")}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to queue
          </Link>
        }
      />

      <section aria-labelledby="score-heading" className="surface-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft/60">
              <span className="font-mono text-2xl font-semibold leading-none text-brand-ink">
                {match.score}%
              </span>
              <span className="mt-1 text-2xs uppercase tracking-wide text-brand-ink">score</span>
            </div>
            <div>
              <h2 id="score-heading" className="text-base font-semibold text-ink-strong">
                Match confidence
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <BandBadge band={match.band} />
                <MatchStatusBadge status={match.status} />
              </div>
              <p className="mt-1.5 text-xs text-muted-fg">
                Suggested {formatDateTime(match.created_at)}
              </p>
            </div>
          </div>

          {pending && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setNote("");
                  setDecision("reject");
                }}
                icon={<XCircle size={16} aria-hidden="true" />}
              >
                Reject
              </Button>
              <Button
                onClick={() => {
                  setNote("");
                  setDecision("confirm");
                }}
                icon={<CheckCircle size={16} aria-hidden="true" />}
              >
                Confirm match
              </Button>
            </div>
          )}
        </div>

        <ScoreMeter score={match.score} band={match.band} className="mt-5 max-w-lg" />

        {!pending && (
          <div
            className={cn(
              "mt-4 flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm",
              match.status === "CONFIRMED"
                ? "bg-success-soft/60 text-success-strong"
                : "bg-danger-soft/50 text-danger-strong",
            )}
          >
            {match.status === "CONFIRMED" ? (
              <CheckCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <p>
              {match.status === "CONFIRMED"
                ? "This match is confirmed. The owner can now submit a claim, and a member of staff still approves the release."
                : "This match was rejected. Both reports stay open and keep matching independently."}
              {match.reviewed_at && (
                <span className="ml-1 text-xs opacity-80">
                  Reviewed {formatRelative(match.reviewed_at)}.
                </span>
              )}
            </p>
          </div>
        )}

        {match.review_note && (
          <p className="mt-3 rounded-lg bg-surface-muted px-3.5 py-2.5 text-sm text-ink-soft">
            <span className="font-semibold text-ink">Review note: </span>
            {match.review_note}
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {lostQuery.isError ? (
          <ErrorState error={lostQuery.error} onRetry={() => lostQuery.refetch()} />
        ) : lostQuery.isPending || !lostQuery.data ? (
          <Skeleton className="h-80 w-full rounded-xl" />
        ) : (
          <ReportPanel report={lostQuery.data} label="Lost report" fieldLabels={lostLabels} />
        )}

        {foundQuery.isError ? (
          <ErrorState error={foundQuery.error} onRetry={() => foundQuery.refetch()} />
        ) : foundQuery.isPending || !foundQuery.data ? (
          <Skeleton className="h-80 w-full rounded-xl" />
        ) : (
          <ReportPanel report={foundQuery.data} label="Found report" fieldLabels={foundLabels} />
        )}
      </div>

      <section aria-labelledby="breakdown-heading" className="surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="breakdown-heading" className="text-base font-semibold text-ink-strong">
              Why the engine suggested this
            </h2>
            <p className="mt-0.5 text-sm text-muted-fg">
              The score is a suggestion. Compare the reports and decide with the verification
              question in mind.
            </p>
          </div>
          <Badge tone="neutral" size="sm">
            Staff only
          </Badge>
        </div>

        <div className="mt-4">
          <ScoreBreakdown breakdown={breakdown} score={match.score} band={match.band} />
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-surface-muted px-3.5 py-3 text-xs leading-relaxed text-muted-fg">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-strong" aria-hidden="true" />
          Confirm only when the details genuinely agree. A high score is not proof of ownership, and
          the claimant still has to answer the private verification question.
        </p>
      </section>

      <ConfirmDialog
        open={decision !== null}
        onClose={() => setDecision(null)}
        onConfirm={async () => {
          await decisionMutation.mutateAsync({
            kind: decision ?? "confirm",
            noteText: note.trim() || undefined,
          });
        }}
        title={decision === "reject" ? "Reject this suggestion?" : "Confirm this match?"}
        description={
          decision === "reject"
            ? "Both reports stay open and keep matching independently. This pairing will be marked rejected in the audit trail."
            : "Both reports will be linked as a confirmed match. The owner can then submit a claim; nothing is released automatically."
        }
        confirmLabel={decision === "reject" ? "Reject match" : "Confirm match"}
        tone={decision === "reject" ? "danger" : "primary"}
      >
        <Textarea
          id="match-note"
          label="Review note"
          hint="Optional, but useful in the audit log. For example: matched on roll number in the private detail."
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
        />
      </ConfirmDialog>
    </div>
  );
}
