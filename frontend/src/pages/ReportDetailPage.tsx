import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  Clock,
  HandHeart,
  LockSimple,
  MapPin,
  ShieldCheck,
  Sparkle,
  User,
  WarningCircle,
} from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { ApiError, errorMessage } from "@/api/errors";
import { mediaUrl } from "@/api/client";
import type { Match } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { CategoryIcon } from "@/components/domain/CategoryIcon";
import { ClaimDialog } from "@/components/domain/ClaimDialog";
import { MatchCard } from "@/components/domain/MatchCard";
import { ReportStatusBadge, TypeBadge } from "@/components/domain/StatusBadges";
import { REPORT_STATUS, FINAL_REPORT_STATUSES } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/format";

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ReportDetailPage() {
  const { id } = useParams();
  const reportId = Number(id);
  const isValidId = Number.isInteger(reportId) && reportId > 0;

  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [claimMatch, setClaimMatch] = useState<Match | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const reportQuery = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => endpoints.report(reportId),
    enabled: isValidId,
  });

  const report = reportQuery.data;
  const isOwner = report?.is_mine ?? false;
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF" || isAdmin;
  const canSeeMatches = isOwner || isAdmin;

  const fieldsQuery = useQuery({
    queryKey: ["category-fields", report?.category.key],
    queryFn: () => endpoints.categoryFields(report!.category.key),
    enabled: Boolean(report?.category.key),
    staleTime: 10 * 60_000,
  });

  const matchesQuery = useQuery({
    queryKey: ["report", reportId, "matches"],
    queryFn: () => endpoints.reportMatches(reportId),
    enabled: isValidId && canSeeMatches,
  });

  const closeMutation = useMutation({
    mutationFn: () => endpoints.closeReport(reportId, closeReason.trim() || undefined),
    onSuccess: () => {
      toast.success("Report closed", "It is now hidden from active matching.");
      queryClient.invalidateQueries({ queryKey: ["report", reportId] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) => toast.error("Could not close the report", errorMessage(error)),
  });

  if (!isValidId) {
    return (
      <EmptyState
        icon={<WarningCircle size={22} aria-hidden="true" />}
        title="That report link is not valid"
        description="Check the address, or browse the reports that are currently open."
        action={
          <Link to="/browse" className={buttonStyles("primary", "sm")}>
            Browse reports
          </Link>
        }
      />
    );
  }

  if (reportQuery.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-2/3" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="surface-card overflow-hidden">
            <Skeleton className="h-64 w-full rounded-none" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-3/4" />
              <SkeletonText lines={3} />
            </div>
          </div>
          <div className="surface-card space-y-3 p-5">
            <Skeleton className="h-4 w-24" />
            <SkeletonText lines={5} />
          </div>
        </div>
      </div>
    );
  }

  if (reportQuery.isError || !report) {
    const notFound = reportQuery.error instanceof ApiError && reportQuery.error.isNotFound;
    return (
      <EmptyState
        icon={<WarningCircle size={22} aria-hidden="true" />}
        title={notFound ? "Report not found" : "We could not load this report"}
        description={
          notFound
            ? "It may have been removed, or the link is wrong."
            : errorMessage(reportQuery.error)
        }
        action={
          <Link to="/browse" className={buttonStyles("primary", "sm")}>
            Browse reports
          </Link>
        }
      />
    );
  }

  const photo = mediaUrl(report.photo_url);
  const statusMeta = REPORT_STATUS[report.status];
  const fieldLabels = new Map((fieldsQuery.data ?? []).map((field) => [field.key, field.label]));
  const attributes = Object.entries(report.attributes ?? {});
  const hiddenAttributes = Object.entries(report.hidden_attributes ?? {});
  const isFinal = FINAL_REPORT_STATUSES.includes(report.status);
  const perspective = report.type === "LOST" ? "lost" : "found";

  function claimDisabledReason(match: Match): string | undefined {
    if (match.status === "REJECTED") return "The desk rejected this suggestion.";
    if (report!.status === "CLAIMED") return "A claim is already under review.";
    if (FINAL_REPORT_STATUSES.includes(report!.status)) return "This report is closed.";
    return undefined;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Browse reports", to: "/browse" }, { label: `Report #${report.id}` }]}
        title={report.title}
        description={`${report.category.label} · ${report.type === "LOST" ? "Lost" : "Found"} · reported ${formatRelative(report.created_at)}`}
        actions={
          <>
            <Link to="/browse" className={buttonStyles("secondary", "md")}>
              <ArrowLeft size={16} aria-hidden="true" />
              Back to browse
            </Link>
            {isOwner && !isFinal && (
              <Button variant="secondary" onClick={() => setCloseOpen(true)}>
                Close report
              </Button>
            )}
            {isStaff && (
              <Link to="/admin/matches" className={buttonStyles("primary", "md")}>
                Desk queue
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
          </>
        }
      />

      {isStaff && (
        <div className="flex flex-col gap-2 rounded-lg border border-info/25 bg-info-soft/50 px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold">Staff view.</span> Score breakdowns and decisions live in
            the desk match queue.
          </p>
          <Link
            to="/admin/matches"
            className="shrink-0 text-xs font-semibold text-brand-strong hover:underline"
          >
            Open the queue
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <article className="surface-card overflow-hidden">
            {photo ? (
              <img
                src={photo}
                alt={`Photo attached to the report "${report.title}"`}
                className="max-h-96 w-full bg-surface-sunken object-contain"
              />
            ) : (
              <div className="flex h-40 w-full items-center justify-center bg-surface-sunken">
                <CategoryIcon
                  icon={report.category.icon}
                  categoryKey={report.category.key}
                  size={48}
                  className="text-brand/35"
                />
              </div>
            )}

            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={report.type} />
                <ReportStatusBadge status={report.status} />
                {report.is_mine && (
                  <Badge tone="neutral" size="sm">
                    Your report
                  </Badge>
                )}
              </div>

              <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink-strong">
                {report.title}
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-fg">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} aria-hidden="true" />
                  {report.location?.path ?? "Location not given"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarBlank size={13} aria-hidden="true" />
                  {formatDateTime(report.occurred_at)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CategoryIcon
                    icon={report.category.icon}
                    categoryKey={report.category.key}
                    size={13}
                  />
                  {report.category.label}
                </span>
              </div>

              {report.public_description ? (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                  {report.public_description}
                </p>
              ) : (
                <p className="mt-4 text-sm italic text-muted-fg">
                  The reporter did not add a public description.
                </p>
              )}

              <p className="mt-4 rounded-lg bg-surface-muted px-3 py-2 text-xs leading-relaxed text-muted-fg">
                <span className="font-semibold text-ink">{statusMeta.label}:</span> {statusMeta.help}
              </p>

              {attributes.length > 0 && (
                <section aria-labelledby="attributes-heading" className="mt-6">
                  <h3 id="attributes-heading" className="text-sm font-semibold text-ink">
                    Details
                  </h3>
                  <dl className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    {attributes.map(([key, value]) => (
                      <div key={key} className="surface-inset px-3 py-2.5">
                        <dt className="text-2xs uppercase tracking-wide text-muted-fg">
                          {fieldLabels.get(key) ?? key.replace(/_/g, " ")}
                        </dt>
                        <dd className="mt-0.5 break-words text-sm font-medium text-ink">
                          {displayValue(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {hiddenAttributes.length > 0 && (
                <section
                  aria-labelledby="private-heading"
                  className="mt-6 rounded-lg border border-accent/30 bg-accent-soft/40 p-4"
                >
                  <h3
                    id="private-heading"
                    className="flex items-center gap-1.5 text-sm font-semibold text-accent-strong"
                  >
                    <LockSimple size={15} aria-hidden="true" />
                    Private verification details
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    Only you and the lost-and-found desk can see these. They are never shown publicly.
                  </p>
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    {hiddenAttributes.map(([key, value]) => (
                      <div key={key} className="rounded-md border border-accent/20 bg-surface/70 px-3 py-2">
                        <dt className="text-2xs uppercase tracking-wide text-muted-fg">
                          {fieldLabels.get(key) ?? key.replace(/_/g, " ")}
                        </dt>
                        <dd className="mt-0.5 break-words text-sm font-medium text-ink">
                          {displayValue(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {report.deposited_location && (
                <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-line bg-surface-muted p-3.5">
                  <HandHeart size={18} className="mt-0.5 shrink-0 text-brand-strong" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-ink">Handed in at</p>
                    <p className="mt-0.5 text-sm text-muted-fg">
                      {report.deposited_location.path}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </article>

          {canSeeMatches && (
            <section aria-labelledby="matches-heading" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="matches-heading" className="text-base font-semibold text-ink-strong">
                  Possible matches
                </h2>
                {matchesQuery.data && (
                  <Badge tone={matchesQuery.data.length > 0 ? "brand" : "neutral"} size="sm">
                    {matchesQuery.data.length}{" "}
                    {matchesQuery.data.length === 1 ? "suggestion" : "suggestions"}
                  </Badge>
                )}
              </div>

              {matchesQuery.isPending ? (
                <div className="space-y-3" aria-busy="true">
                  <Skeleton className="h-40 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                </div>
              ) : matchesQuery.isError ? (
                <ErrorState error={matchesQuery.error} onRetry={() => matchesQuery.refetch()} />
              ) : matchesQuery.data.length === 0 ? (
                <EmptyState
                  icon={<Sparkle size={22} aria-hidden="true" />}
                  title="No matches yet"
                  description="Matching runs again whenever a new report is added. A photo, a specific location and a few detail fields make a match much more likely."
                  action={
                    <Link to="/browse" className={buttonStyles("secondary", "sm")}>
                      Browse what others reported
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {matchesQuery.data.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      perspective={perspective}
                      onClaim={report.type === "LOST" ? setClaimMatch : undefined}
                      claimDisabledReason={claimDisabledReason(match)}
                      extraAction={
                        isAdmin ? (
                          <Link
                            to={`/admin/matches/${match.id}`}
                            className={buttonStyles("secondary", "sm")}
                          >
                            Score breakdown
                          </Link>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              )}

              <p className="text-xs leading-relaxed text-muted-fg">
                Matches are suggestions, never automatic decisions. A member of staff reviews every
                claim before an item is released.
              </p>
            </section>
          )}

          {!canSeeMatches && !isStaff && (
            <div className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-muted-fg">
              Possible matches are visible to the person who filed this report and to the
              lost-and-found desk.
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-5">
            <h2 className="text-sm font-semibold text-ink-strong">Report details</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-fg">Status</dt>
                <dd>
                  <ReportStatusBadge status={report.status} size="sm" />
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-fg">Category</dt>
                <dd className="text-right font-medium text-ink">{report.category.label}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-fg">Location</dt>
                <dd className="max-w-[60%] text-right font-medium text-ink">
                  {report.location?.path ?? "Not given"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-fg">{report.type === "LOST" ? "Lost around" : "Found at"}</dt>
                <dd className="text-right font-medium text-ink">
                  {formatDateTime(report.occurred_at)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-fg">Reported</dt>
                <dd className="text-right font-medium text-ink">{formatDateTime(report.created_at)}</dd>
              </div>
              {report.reporter_name && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-fg">Reporter</dt>
                  <dd className="flex items-center gap-1.5 text-right font-medium text-ink">
                    <User size={13} aria-hidden="true" className="text-muted-fg" />
                    {report.reporter_name}
                  </dd>
                </div>
              )}
              <div className="flex items-start justify-between gap-3 border-t border-line pt-2.5">
                <dt className="text-muted-fg">Reference</dt>
                <dd className="font-mono text-xs font-medium text-ink">#{report.id}</dd>
              </div>
            </dl>

            {report.has_hidden_detail && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-brand-soft/50 px-3 py-2 text-xs leading-relaxed text-brand-ink">
                <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                {isOwner || isAdmin
                  ? "A private free-text detail is on file for verification. It is never shown in the report body."
                  : "The reporter left a private detail on file. It is never shown in the report or in match suggestions."}
              </p>
            )}
          </div>

          {(isOwner || isStaff) && (
            <div className="surface-card p-5">
              <h2 className="text-sm font-semibold text-ink-strong">Next steps</h2>
              <div className="mt-3 space-y-2">
                {isOwner && report.type === "LOST" && matchesQuery.data && matchesQuery.data.length > 0 && (
                  <p className="text-xs leading-relaxed text-muted-fg">
                    Think one of these is yours? Open it and choose{" "}
                    <span className="font-medium text-ink">This is mine</span> to answer the
                    verification question.
                  </p>
                )}
                {isOwner && !isFinal && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setCloseOpen(true)}
                  >
                    Close this report
                  </Button>
                )}
                {isOwner && isFinal && (
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-fg">
                    <CheckCircle size={14} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                    This report is resolved. Thank you for keeping the campus in sync.
                  </p>
                )}
                <Link to="/reports/new" className={buttonStyles("ghost", "sm", "w-full")}>
                  Report another item
                </Link>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface-muted p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <ShieldCheck size={14} className="text-brand-strong" aria-hidden="true" />
              Collect safely
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-fg">
              Collect items from the Security Office in the Main Block during college hours. Never
              arrange a handover somewhere private, and never share your password or bank details.
            </p>
          </div>

          <div className="flex items-center gap-2 px-1 text-xs text-muted-fg">
            <Clock size={13} aria-hidden="true" />
            Last updated {formatRelative(report.updated_at)}
          </div>
        </aside>
      </div>

      <ClaimDialog open={Boolean(claimMatch)} match={claimMatch} onClose={() => setClaimMatch(null)} />

      <ConfirmDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onConfirm={async () => {
          await closeMutation.mutateAsync();
        }}
        title="Close this report?"
        description="It will stop being matched against new reports. You cannot undo this from the app."
        confirmLabel="Close report"
        tone="danger"
      >
        <Textarea
          id="close-reason"
          label="Reason"
          hint="Optional. For example: found it myself."
          rows={2}
          value={closeReason}
          onChange={(event) => setCloseReason(event.target.value)}
          maxLength={255}
        />
      </ConfirmDialog>
    </div>
  );
}
