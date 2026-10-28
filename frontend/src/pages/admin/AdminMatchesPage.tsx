import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkle } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import type { MatchBand, MatchStatus } from "@/api/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonStyles } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { BandBadge, MatchStatusBadge } from "@/components/domain/StatusBadges";
import { ScoreMeter } from "@/components/domain/ScoreMeter";
import { formatRelative } from "@/lib/format";

const PAGE_SIZE = 15;

const selectClass =
  "h-10 w-full cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-sm text-ink transition-colors " +
  "hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

function isMatchStatus(value: string | null): value is MatchStatus {
  return value === "SUGGESTED" || value === "CONFIRMED" || value === "REJECTED";
}

function isMatchBand(value: string | null): value is MatchBand {
  return value === "HIGH" || value === "MEDIUM";
}

export function AdminMatchesPage() {
  const [params, setParams] = useSearchParams();

  const statusParam = params.get("status");
  const bandParam = params.get("band");
  const status = isMatchStatus(statusParam) ? statusParam : undefined;
  const band = isMatchBand(bandParam) ? bandParam : undefined;
  const minScore = Math.max(0, Math.min(100, Number(params.get("min_score") ?? "0") || 0));
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  const matchesQuery = useQuery({
    queryKey: ["admin", "matches", { status, band, minScore, page }],
    queryFn: () =>
      endpoints.adminMatches({
        status,
        band,
        min_score: minScore || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const total = matchesQuery.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Match queue"
        description="Every LOST/FOUND pairing the engine has suggested. Open a pairing to see the score breakdown and confirm or reject it."
        breadcrumbs={[{ label: "Desk dashboard", to: "/admin" }, { label: "Match queue" }]}
        actions={
          <Link to="/admin/matches?status=SUGGESTED" className={buttonStyles("primary", "md")}>
            <Sparkle size={16} aria-hidden="true" />
            Unreviewed only
          </Link>
        }
      />

      <section aria-label="Match filters" className="surface-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="match-status" className="mb-1.5 block text-xs font-medium text-ink">
              Status
            </label>
            <select
              id="match-status"
              value={status ?? ""}
              onChange={(event) => update({ status: event.target.value || undefined, page: undefined })}
              className={selectClass}
            >
              <option value="">Any status</option>
              <option value="SUGGESTED">Needs review</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label htmlFor="match-band" className="mb-1.5 block text-xs font-medium text-ink">
              Confidence
            </label>
            <select
              id="match-band"
              value={band ?? ""}
              onChange={(event) => update({ band: event.target.value || undefined, page: undefined })}
              className={selectClass}
            >
              <option value="">Any confidence</option>
              <option value="HIGH">High confidence</option>
              <option value="MEDIUM">Possible</option>
            </select>
          </div>

          <div>
            <label htmlFor="match-min-score" className="mb-1.5 block text-xs font-medium text-ink">
              Minimum score
            </label>
            <select
              id="match-min-score"
              value={String(minScore)}
              onChange={(event) => update({ min_score: event.target.value, page: undefined })}
              className={selectClass}
            >
              <option value="0">Any score</option>
              <option value="65">65% and above</option>
              <option value="85">85% and above</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-surface-muted"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="matches-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="matches-heading" className="text-sm font-semibold text-ink">
            {matchesQuery.isPending ? "Loading matches..." : `${total} ${total === 1 ? "match" : "matches"}`}
          </h2>
          {matchesQuery.isFetching && !matchesQuery.isPending && (
            <span className="text-xs text-muted-fg" role="status">
              Updating...
            </span>
          )}
        </div>

        {matchesQuery.isError ? (
          <ErrorState error={matchesQuery.error} onRetry={() => matchesQuery.refetch()} />
        ) : matchesQuery.isPending ? (
          <SkeletonRows rows={6} />
        ) : matchesQuery.data.items.length === 0 ? (
          <EmptyState
            icon={<Sparkle size={22} aria-hidden="true" />}
            title="No matches with these filters"
            description="Try a lower minimum score or clear the filters. New suggestions appear automatically."
            action={
              <button
                type="button"
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
                className={buttonStyles("secondary", "sm")}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 xl:hidden">
              {matchesQuery.data.items.map((match) => (
                <li key={match.id}>
                  <Link
                    to={`/admin/matches/${match.id}`}
                    className="surface-card flex h-full flex-col p-4 transition-shadow hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-semibold text-ink-strong">
                            {match.score}%
                          </span>
                          <BandBadge band={match.band} size="sm" />
                        </div>
                        <ScoreMeter
                          score={match.score}
                          band={match.band}
                          showLabel={false}
                          className="mt-1.5 w-28"
                        />
                      </div>
                      <MatchStatusBadge status={match.status} size="sm" />
                    </div>

                    <dl className="mt-4 space-y-2.5 text-sm">
                      <div>
                        <dt className="text-2xs font-semibold uppercase tracking-wide text-muted-fg">
                          Lost
                        </dt>
                        <dd className="mt-0.5 font-medium text-ink">{match.lost_report.title}</dd>
                        <dd className="text-xs text-muted-fg">
                          {match.lost_report.category.label} ·{" "}
                          {match.lost_report.location?.name ?? "No location"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-2xs font-semibold uppercase tracking-wide text-muted-fg">
                          Found
                        </dt>
                        <dd className="mt-0.5 font-medium text-ink">{match.found_report.title}</dd>
                        <dd className="text-xs text-muted-fg">
                          {match.found_report.category.label} ·{" "}
                          {match.found_report.location?.name ?? "No location"}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs">
                      <span className="text-muted-fg">Suggested {formatRelative(match.created_at)}</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-brand-strong">
                        Review
                        <ArrowRight size={12} aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <div
              role="region"
              aria-label="Match results"
              className="surface-card hidden overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand xl:block"
            >
              <table className="w-full min-w-[860px] text-left text-sm">
                <caption className="sr-only">Suggested lost and found matches</caption>
                <thead className="border-b border-line bg-surface-muted text-xs text-muted-fg">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Score</th>
                    <th scope="col" className="px-4 py-3 font-medium">Lost report</th>
                    <th scope="col" className="px-4 py-3 font-medium">Found report</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium">Suggested</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {matchesQuery.data.items.map((match) => (
                    <tr key={match.id} className="transition-colors hover:bg-surface-muted/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-10 font-mono text-sm font-semibold text-ink-strong">
                            {match.score}%
                          </span>
                          <BandBadge band={match.band} size="sm" />
                        </div>
                        <ScoreMeter
                          score={match.score}
                          band={match.band}
                          showLabel={false}
                          className="mt-1.5 w-28"
                        />
                      </td>
                      <td className="max-w-[15rem] px-4 py-3">
                        <Link
                          to={`/reports/${match.lost_report.id}`}
                          className="block truncate font-medium text-ink hover:text-brand-strong hover:underline"
                        >
                          {match.lost_report.title}
                        </Link>
                        <span className="block truncate text-xs text-muted-fg">
                          {match.lost_report.category.label} ·{" "}
                          {match.lost_report.location?.name ?? "No location"}
                        </span>
                      </td>
                      <td className="max-w-[15rem] px-4 py-3">
                        <Link
                          to={`/reports/${match.found_report.id}`}
                          className="block truncate font-medium text-ink hover:text-brand-strong hover:underline"
                        >
                          {match.found_report.title}
                        </Link>
                        <span className="block truncate text-xs text-muted-fg">
                          {match.found_report.category.label} ·{" "}
                          {match.found_report.location?.name ?? "No location"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <MatchStatusBadge status={match.status} size="sm" />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-fg">
                        {formatRelative(match.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/admin/matches/${match.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-strong hover:bg-brand-soft"
                        >
                          Open
                          <ArrowRight size={12} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={matchesQuery.data.page}
              pages={matchesQuery.data.pages}
              total={matchesQuery.data.total}
              onPageChange={(nextPage) => update({ page: String(nextPage) })}
              itemLabel="matches"
              itemLabelSingular="match"
            />
          </>
        )}
      </section>
    </div>
  );
}
