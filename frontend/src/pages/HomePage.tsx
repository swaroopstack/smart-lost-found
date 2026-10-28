import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  HandHeart,
  MagnifyingGlass,
  MapPin,
  NotePencil,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SkeletonCard, SkeletonRows } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReportCard } from "@/components/domain/ReportCard";
import { StatTile } from "@/components/domain/StatTile";
import { ReportStatusBadge, TypeBadge } from "@/components/domain/StatusBadges";
import { ScoreMeter } from "@/components/domain/ScoreMeter";
import { FINAL_REPORT_STATUSES } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/format";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function ActionCard({
  to,
  tone,
  icon,
  title,
  body,
  cta,
}: {
  to: string;
  tone: "accent" | "brand";
  icon: ReactNode;
  title: string;
  body: string;
  cta: string;
}) {
  const tint =
    tone === "accent"
      ? "bg-accent-soft text-accent-strong"
      : "bg-brand-soft text-brand-strong";

  return (
    <Link
      to={to}
      className="group flex flex-col justify-between gap-5 p-6 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
    >
      <div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
          {icon}
        </span>
        <h2 className="mt-3.5 text-lg font-semibold text-ink-strong">{title}</h2>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-fg">{body}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-strong">
        {cta}
        <ArrowRight
          size={15}
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const isStaff = user?.role === "STAFF" || user?.role === "ADMIN";

  const mineQuery = useQuery({
    queryKey: ["reports", "mine", "home"],
    queryFn: () => endpoints.reports({ mine: true, page_size: 8 }),
  });

  const recentQuery = useQuery({
    queryKey: ["reports", "recent"],
    queryFn: () => endpoints.reports({ page_size: 6 }),
  });

  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: endpoints.statsToday,
    enabled: isStaff,
  });

  const queueQuery = useQuery({
    queryKey: ["admin", "queue", 5],
    queryFn: () => endpoints.verificationQueue(5),
    enabled: isStaff,
  });

  if (!user) return null;

  const activeReports = (mineQuery.data?.items ?? [])
    .filter((report) => !FINAL_REPORT_STATUSES.includes(report.status))
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={formatDateTime(new Date()).split(",")[0]}
        title={`${greeting()}, ${user.full_name.split(" ")[0]}`}
        description={
          isStaff
            ? "Here is what the campus reported today and what is waiting for a human decision."
            : "Report what you lost, hand in what you found, and track everything in one place."
        }
        actions={
          <>
            <Link to="/browse" className={buttonStyles("secondary", "md")}>
              <MagnifyingGlass size={16} aria-hidden="true" />
              Browse reports
            </Link>
            <Link to="/reports/new" className={buttonStyles("primary", "md")}>
              <NotePencil size={16} aria-hidden="true" />
              Report an item
            </Link>
          </>
        }
      />

      {isStaff ? (
        <>
          <section aria-labelledby="today-heading">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="today-heading" className="text-sm font-semibold text-ink">
                Today at a glance
              </h2>
              <Link
                to="/admin"
                className="text-xs font-semibold text-brand-strong hover:underline"
              >
                Open desk dashboard
              </Link>
            </div>

            {statsQuery.isPending ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="surface-card h-[6.5rem] p-4">
                    <div className="skeleton h-3 w-16" />
                    <div className="skeleton mt-3 h-6 w-10" />
                  </div>
                ))}
              </div>
            ) : statsQuery.isError ? (
              <ErrorState error={statsQuery.error} onRetry={() => statsQuery.refetch()} />
            ) : statsQuery.data ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <StatTile
                  label="Lost reports"
                  value={statsQuery.data.lost_reports}
                  icon={NotePencil}
                  tone="accent"
                />
                <StatTile
                  label="Found reports"
                  value={statsQuery.data.found_reports}
                  icon={HandHeart}
                  tone="brand"
                />
                <StatTile
                  label="Possible matches"
                  value={statsQuery.data.possible_matches}
                  icon={Sparkle}
                  tone="info"
                  to="/admin/matches"
                />
                <StatTile
                  label="Items returned"
                  value={statsQuery.data.items_returned}
                  icon={CheckCircle}
                  tone="success"
                />
                <StatTile
                  label="Pending claims"
                  value={statsQuery.data.pending_claims}
                  icon={ClipboardText}
                  tone="accent"
                  to="/admin/claims"
                />
                <StatTile
                  label="Open reports"
                  value={statsQuery.data.open_reports}
                  icon={MagnifyingGlass}
                  tone="neutral"
                  to="/browse?status=OPEN"
                />
              </div>
            ) : null}
          </section>

          <section aria-labelledby="queue-heading" className="surface-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 id="queue-heading" className="text-base font-semibold text-ink-strong">
                  Verification queue
                </h2>
                <p className="mt-0.5 text-xs text-muted-fg">
                  Unreviewed matches, strongest first. Nothing is returned without a human decision.
                </p>
              </div>
              <Link to="/admin/matches" className={buttonStyles("secondary", "sm")}>
                View all matches
              </Link>
            </div>

            {queueQuery.isPending ? (
              <SkeletonRows rows={4} />
            ) : queueQuery.isError ? (
              <div className="p-4">
                <ErrorState error={queueQuery.error} onRetry={() => queueQuery.refetch()} />
              </div>
            ) : queueQuery.data.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<CheckCircle size={22} aria-hidden="true" />}
                  title="The queue is clear"
                  description="Every suggested match has been reviewed. New ones will appear here automatically."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {queueQuery.data.map((item) => (
                  <li key={item.match_id}>
                    <Link
                      to={`/admin/matches/${item.match_id}`}
                      className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-surface-muted sm:flex-row sm:items-center"
                    >
                      <div className="w-full min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={item.band === "HIGH" ? "brand" : "accent"} size="sm">
                            {item.band === "HIGH" ? "High confidence" : "Possible"}
                          </Badge>
                          <span className="font-mono text-sm font-semibold text-ink-strong">
                            {item.score}%
                          </span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-medium text-ink">
                          {item.lost_report.title}
                          <span className="mx-1.5 text-muted-fg">↔</span>
                          {item.found_report.title}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-fg">
                          <MapPin size={12} aria-hidden="true" />
                          {item.lost_report.location?.name ?? "Unknown"} ·{" "}
                          {formatRelative(item.created_at)}
                        </p>
                      </div>
                      <div className="w-full sm:w-40">
                        <ScoreMeter score={item.score} band={item.band} showLabel={false} />
                      </div>
                      <ArrowRight size={16} className="hidden shrink-0 text-muted-fg sm:block" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
          <section aria-label="Report an item" className="surface-card overflow-hidden">
            <div className="grid md:grid-cols-2 md:divide-x md:divide-line">
              <ActionCard
                to="/reports/new?type=LOST"
                tone="accent"
                icon={<WarningCircle size={22} aria-hidden="true" />}
                title="I lost something"
                body="Tell us what it is, where you last had it, and when. We start looking immediately."
                cta="Report a lost item"
              />
              <ActionCard
                to="/reports/new?type=FOUND"
                tone="brand"
                icon={<HandHeart size={22} aria-hidden="true" />}
                title="I found something"
                body="Hand it in to the desk, or log it here so the owner can be matched to it."
                cta="Report a found item"
              />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section aria-labelledby="active-heading" className="surface-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <h2 id="active-heading" className="text-base font-semibold text-ink-strong">
                  Your active reports
                </h2>
                <Link to="/my-reports" className="text-xs font-semibold text-brand-strong hover:underline">
                  See all
                </Link>
              </div>

              {mineQuery.isPending ? (
                <SkeletonRows rows={3} />
              ) : mineQuery.isError ? (
                <div className="p-4">
                  <ErrorState error={mineQuery.error} onRetry={() => mineQuery.refetch()} />
                </div>
              ) : activeReports.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<ClipboardText size={22} aria-hidden="true" />}
                    title="Nothing open right now"
                    description="When you report a lost or found item it will appear here with its live status."
                    action={
                      <Link to="/reports/new" className={buttonStyles("primary", "sm")}>
                        Report an item
                      </Link>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {activeReports.map((report) => (
                    <li key={report.id}>
                      <Link
                        to={`/reports/${report.id}`}
                        className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-muted"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <TypeBadge type={report.type} size="sm" />
                            <ReportStatusBadge status={report.status} size="sm" />
                          </div>
                          <p className="mt-1.5 truncate text-sm font-medium text-ink">{report.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-fg">
                            {report.location?.path ?? "No location"} · {formatRelative(report.created_at)}
                          </p>
                        </div>
                        <ArrowRight size={16} className="shrink-0 text-muted-fg" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="how-heading" className="surface-card p-5">
              <h2 id="how-heading" className="text-base font-semibold text-ink-strong">
                How a return happens
              </h2>
              <ol className="mt-4 space-y-4">
                {[
                  ["Report it", "Add the place, time and a photo. More detail means better matches."],
                  ["Get matched", "We score every lost report against every found report."],
                  ["Prove it is yours", "Answer the private verification question."],
                  ["Collect at the desk", "Staff approve the claim before the item is released."],
                ].map(([title, body], index) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft font-mono text-2xs font-semibold text-brand-ink">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-ink">{title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-fg">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 rounded-lg bg-surface-muted p-3">
                <p className="text-xs leading-relaxed text-muted-fg">
                  <span className="font-medium text-ink">Tip:</span> log a found item even if you hand
                  it to the desk. The report is what lets the owner find it.
                </p>
              </div>
            </section>
          </div>
        </>
      )}

      <section aria-labelledby="recent-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="recent-heading" className="text-sm font-semibold text-ink">
            Recently reported on campus
          </h2>
          <Link to="/browse" className="text-xs font-semibold text-brand-strong hover:underline">
            Browse all
          </Link>
        </div>

        {recentQuery.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : recentQuery.isError ? (
          <ErrorState error={recentQuery.error} onRetry={() => recentQuery.refetch()} />
        ) : recentQuery.data.items.length === 0 ? (
          <EmptyState
            icon={<MagnifyingGlass size={22} aria-hidden="true" />}
            title="No reports yet"
            description="Be the first to report an item. Everything you add helps the whole campus."
            action={
              <Link to="/reports/new" className={buttonStyles("primary", "sm")}>
                Report an item
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recentQuery.data.items.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </section>

      {!isStaff && (
        <section className="rounded-xl border border-brand/20 bg-brand-soft/40 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-brand-ink">Found something? Log it.</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
                A one-minute report is often the difference between an item going home and staying in
                the lost-and-found box.
              </p>
            </div>
            <Link to="/reports/new?type=FOUND" className={buttonStyles("primary", "md")}>
              Report a found item
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
