import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardText, NotePencil } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { mediaUrl } from "@/api/client";
import type { ReportStatus, ReportSummary } from "@/api/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonStyles } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { CategoryIcon } from "@/components/domain/CategoryIcon";
import { ReportStatusBadge, TypeBadge } from "@/components/domain/StatusBadges";
import { REPORT_STATUS } from "@/lib/constants";
import { formatRelative } from "@/lib/format";

const PAGE_SIZE = 10;

function ReportRow({ report }: { report: ReportSummary }) {
  const photo = mediaUrl(report.photo_url);

  return (
    <Link
      to={`/reports/${report.id}`}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CategoryIcon
              icon={report.category.icon}
              categoryKey={report.category.key}
              size={20}
              className="text-brand/40"
            />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={report.type} size="sm" />
          <ReportStatusBadge status={report.status} size="sm" />
        </div>
        <p className="mt-1 truncate text-sm font-medium text-ink">{report.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-fg">
          {report.category.label} · {report.location?.name ?? "No location"} ·{" "}
          {formatRelative(report.created_at)}
        </p>
      </div>

      <ArrowRight size={16} className="shrink-0 text-muted-fg" aria-hidden="true" />
    </Link>
  );
}

export function MyReportsPage() {
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  const status =
    statusParam && statusParam in REPORT_STATUS ? (statusParam as ReportStatus) : undefined;
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  function setFilter(nextStatus: string, nextPage = 1) {
    const next = new URLSearchParams();
    if (nextStatus) next.set("status", nextStatus);
    if (nextPage > 1) next.set("page", String(nextPage));
    setParams(next, { replace: true });
  }

  const reportsQuery = useQuery({
    queryKey: ["reports", "mine", { status, page }],
    queryFn: () =>
      endpoints.reports({
        mine: true,
        status,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My reports"
        description="Everything you have reported, with its current status. Open a report to see its matches."
        actions={
          <Link to="/reports/new" className={buttonStyles("primary", "md")}>
            <NotePencil size={16} aria-hidden="true" />
            Report an item
          </Link>
        }
      />

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <SegmentedControl
          label="Filter by status"
          value={status ?? ""}
          options={[
            { value: "", label: "All" },
            { value: "OPEN", label: "Open" },
            { value: "MATCHED", label: "Matched" },
            { value: "CLAIMED", label: "Claimed" },
            { value: "RETURNED", label: "Returned" },
            { value: "CLOSED", label: "Closed" },
          ]}
          onChange={(value) => setFilter(value)}
        />
      </div>

      {reportsQuery.isError ? (
        <ErrorState error={reportsQuery.error} onRetry={() => reportsQuery.refetch()} />
      ) : reportsQuery.isPending ? (
        <SkeletonRows rows={5} />
      ) : reportsQuery.data.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardText size={22} aria-hidden="true" />}
          title={status ? `No ${REPORT_STATUS[status].label.toLowerCase()} reports` : "No reports yet"}
          description={
            status
              ? "Try another status, or view everything you have reported."
              : "When you report a lost or found item it will appear here with its live status and matches."
          }
          action={
            status ? (
              <button
                type="button"
                onClick={() => setFilter("")}
                className={buttonStyles("secondary", "sm")}
              >
                Show all reports
              </button>
            ) : (
              <Link to="/reports/new" className={buttonStyles("primary", "sm")}>
                Report your first item
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="surface-card divide-y divide-line overflow-hidden">
            {reportsQuery.data.items.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </div>

          <Pagination
            page={reportsQuery.data.page}
            pages={reportsQuery.data.pages}
            total={reportsQuery.data.total}
            onPageChange={(nextPage) => setFilter(status ?? "", nextPage)}
            itemLabel="reports"
            itemLabelSingular="report"
          />
        </>
      )}
    </div>
  );
}
