import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardText, Info } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonStyles } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ClaimStatusBadge } from "@/components/domain/StatusBadges";
import { formatDateTime } from "@/lib/format";

export function MyClaimsPage() {
  const claimsQuery = useQuery({
    queryKey: ["claims", "mine"],
    queryFn: () => endpoints.myClaims({ page_size: 20 }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My claims"
        description="Ownership claims you have submitted. The desk checks each answer against the item and the finder's report."
        actions={
          <Link to="/my-reports" className={buttonStyles("secondary", "md")}>
            My reports
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      />

      <div className="flex items-start gap-2.5 rounded-lg border border-brand/20 bg-brand-soft/40 px-4 py-3 text-sm text-brand-ink">
        <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          A claim does not release the item by itself. A member of staff compares your answer with
          the detail recorded when the item was handed in, then approves or rejects it. You will get a
          notification either way.
        </p>
      </div>

      {claimsQuery.isError ? (
        <ErrorState error={claimsQuery.error} onRetry={() => claimsQuery.refetch()} />
      ) : claimsQuery.isPending ? (
        <SkeletonRows rows={4} />
      ) : claimsQuery.data.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardText size={22} aria-hidden="true" />}
          title="No claims yet"
          description="When a possible match appears on one of your lost reports, open it and choose “This is mine” to submit a claim."
          action={
            <Link to="/my-reports" className={buttonStyles("primary", "sm")}>
              Go to my reports
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {claimsQuery.data.items.map((claim) => (
            <li key={claim.id} className="surface-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-fg">Claim #{claim.id}</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    Match #{claim.match_id}
                  </p>
                </div>
                <ClaimStatusBadge status={claim.status} />
              </div>

              <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
                <div className="flex gap-1.5">
                  <dt className="text-muted-fg">Submitted</dt>
                  <dd className="font-medium text-ink">{formatDateTime(claim.created_at)}</dd>
                </div>
                {claim.decided_at && (
                  <div className="flex gap-1.5">
                    <dt className="text-muted-fg">Reviewed</dt>
                    <dd className="font-medium text-ink">{formatDateTime(claim.decided_at)}</dd>
                  </div>
                )}
              </dl>

              {claim.notes && (
                <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-sm leading-relaxed text-ink-soft">
                  <span className="font-medium text-ink">Note from the desk: </span>
                  {claim.notes}
                </p>
              )}

              {claim.status === "PENDING" && (
                <p className="mt-3 text-xs text-muted-fg">
                  Waiting for review. You can keep browsing; nothing else is required from you.
                </p>
              )}

              <div className="mt-3 border-t border-line pt-3">
                <Link
                  to="/my-reports"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-strong hover:underline"
                >
                  Open my reports to see the item
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
