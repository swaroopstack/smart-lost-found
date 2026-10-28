import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  HandHeart,
  MagnifyingGlass,
  NotePencil,
  Sparkle,
  Scroll,
  UsersThree,
} from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/domain/StatTile";
import { ScoreMeter } from "@/components/domain/ScoreMeter";
import { BandBadge } from "@/components/domain/StatusBadges";
import { formatDate, formatRelative } from "@/lib/format";

export function AdminDashboardPage() {
  const { user } = useAuth();

  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: endpoints.statsToday,
  });

  const queueQuery = useQuery({
    queryKey: ["admin", "queue", 8],
    queryFn: () => endpoints.verificationQueue(8),
  });

  const metaQuery = useQuery({
    queryKey: ["meta"],
    queryFn: endpoints.meta,
    staleTime: 30 * 60_000,
  });

  const high = metaQuery.data?.matching.thresholds.high_band ?? 85;
  const medium = metaQuery.data?.matching.thresholds.medium_band ?? 65;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={formatDate(new Date())}
        title="Lost & found desk"
        description="Today's numbers, the verification queue, and the two decisions that keep the desk moving."
        actions={
          <>
            <Link to="/admin/claims" className={buttonStyles("secondary", "md")}>
              <ClipboardText size={16} aria-hidden="true" />
              Claim reviews
            </Link>
            <Link to="/admin/matches" className={buttonStyles("primary", "md")}>
              <Sparkle size={16} aria-hidden="true" />
              Match queue
            </Link>
          </>
        }
      />

      {statsQuery.isError ? (
        <ErrorState error={statsQuery.error} onRetry={() => statsQuery.refetch()} />
      ) : statsQuery.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="surface-card h-[6.5rem] p-4">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton mt-3 h-6 w-10" />
            </div>
          ))}
        </div>
      ) : statsQuery.data ? (
        <section aria-label="Today's counters" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Lost reports" value={statsQuery.data.lost_reports} icon={NotePencil} tone="accent" hint="Reported today" />
          <StatTile label="Found reports" value={statsQuery.data.found_reports} icon={HandHeart} tone="brand" hint="Handed in today" />
          <StatTile label="Possible matches" value={statsQuery.data.possible_matches} icon={Sparkle} tone="info" hint="Created today" />
          <StatTile label="Items returned" value={statsQuery.data.items_returned} icon={CheckCircle} tone="success" hint="Closed today" />
          <StatTile label="Pending claims" value={statsQuery.data.pending_claims} icon={ClipboardText} tone="accent" hint="Waiting for you" to="/admin/claims" />
          <StatTile label="Open reports" value={statsQuery.data.open_reports} icon={MagnifyingGlass} tone="neutral" hint="Still unresolved" to="/browse?status=OPEN" />
        </section>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="queue-heading" className="surface-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 id="queue-heading" className="text-base font-semibold text-ink-strong">
                Verification queue
              </h2>
              <p className="mt-0.5 text-xs text-muted-fg">
                Strongest suggestions first. A human confirms before anything is released.
              </p>
            </div>
            <Link to="/admin/matches" className={buttonStyles("secondary", "sm")}>
              All matches
            </Link>
          </div>

          {queueQuery.isError ? (
            <div className="p-4">
              <ErrorState error={queueQuery.error} onRetry={() => queueQuery.refetch()} />
            </div>
          ) : queueQuery.isPending ? (
            <SkeletonRows rows={5} />
          ) : queueQuery.data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<CheckCircle size={22} aria-hidden="true" />}
                title="Queue clear"
                description="Every suggested match has been reviewed. New suggestions appear automatically when reports are added."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {queueQuery.data.map((item) => (
                <li key={item.match_id}>
                  <Link
                    to={`/admin/matches/${item.match_id}`}
                    className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex items-center gap-3 sm:w-32 sm:shrink-0 sm:flex-col sm:items-start sm:gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-semibold text-ink-strong">
                          {item.score}%
                        </span>
                        <BandBadge band={item.band} size="sm" />
                      </div>
                      <ScoreMeter
                        score={item.score}
                        band={item.band}
                        showLabel={false}
                        className="hidden w-24 sm:flex"
                      />
                    </div>

                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 sm:gap-3">
                      <div className="min-w-0">
                        <p className="text-2xs uppercase tracking-wide text-muted-fg">Lost</p>
                        <p className="truncate text-sm font-medium text-ink">
                          {item.lost_report.title}
                        </p>
                        <p className="truncate text-xs text-muted-fg">
                          {item.lost_report.location?.name ?? "No location"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xs uppercase tracking-wide text-muted-fg">Found</p>
                        <p className="truncate text-sm font-medium text-ink">
                          {item.found_report.title}
                        </p>
                        <p className="truncate text-xs text-muted-fg">
                          {item.found_report.location?.name ?? "No location"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:w-24 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1">
                      <span className="text-xs text-muted-fg">
                        {formatRelative(item.created_at)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong">
                        Review
                        <ArrowRight size={12} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <div className="surface-card p-5">
            <h2 className="text-sm font-semibold text-ink-strong">Needs a decision</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  to="/admin/claims?status=PENDING"
                  className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-surface-muted"
                >
                  <span className="text-sm text-ink">Claims waiting</span>
                  <Badge tone="accent" size="sm">
                    {statsQuery.data?.pending_claims ?? 0}
                  </Badge>
                </Link>
              </li>
              <li>
                <Link
                  to="/admin/matches"
                  className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-surface-muted"
                >
                  <span className="text-sm text-ink">Matches to review</span>
                  <Badge tone="info" size="sm">
                    {queueQuery.data?.length ?? 0}
                  </Badge>
                </Link>
              </li>
              <li>
                <Link
                  to="/browse?status=OPEN"
                  className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-surface-muted"
                >
                  <span className="text-sm text-ink">Open reports</span>
                  <Badge tone="neutral" size="sm">
                    {statsQuery.data?.open_reports ?? 0}
                  </Badge>
                </Link>
              </li>
            </ul>
          </div>

          <div className="surface-card p-5">
            <h2 className="text-sm font-semibold text-ink-strong">Shortcuts</h2>
            <div className="mt-3 space-y-1">
              <Link to="/admin/matches" className={buttonStyles("ghost", "sm", "w-full justify-start")}>
                <Sparkle size={15} aria-hidden="true" />
                Match queue
              </Link>
              <Link to="/admin/claims" className={buttonStyles("ghost", "sm", "w-full justify-start")}>
                <ClipboardText size={15} aria-hidden="true" />
                Claim reviews
              </Link>
              {user?.role === "ADMIN" && (
                <>
                  <Link to="/admin/users" className={buttonStyles("ghost", "sm", "w-full justify-start")}>
                    <UsersThree size={15} aria-hidden="true" />
                    Users and roles
                  </Link>
                  <Link to="/admin/audit" className={buttonStyles("ghost", "sm", "w-full justify-start")}>
                    <Scroll size={15} aria-hidden="true" />
                    Audit log
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface-muted p-4">
            <p className="text-xs font-semibold text-ink">How the bands work</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-fg">
              <span className="font-medium text-brand-strong">High confidence</span> at {high}% or more,
              <span className="font-medium text-accent-strong"> possible</span> from {medium}%. Below{" "}
              {medium}% nothing is queued. Scores never return an item on their own.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
