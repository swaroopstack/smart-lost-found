import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FunnelSimple, MagnifyingGlass, NotePencil, X } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import type { ReportStatus, ReportType } from "@/api/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonStyles } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ReportCard } from "@/components/domain/ReportCard";
import { REPORT_STATUS } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 12;

const filterSelect =
  "h-10 w-full cursor-pointer rounded-lg border border-line bg-surface px-2.5 text-sm text-ink transition-colors " +
  "hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

function isReportType(value: string | null): value is ReportType {
  return value === "LOST" || value === "FOUND";
}

function isReportStatus(value: string | null): value is ReportStatus {
  return Boolean(value && value in REPORT_STATUS);
}

export function BrowsePage() {
  const [params, setParams] = useSearchParams();

  const typeParam = params.get("type");
  const statusParam = params.get("status");
  const type = isReportType(typeParam) ? typeParam : undefined;
  const status = isReportStatus(statusParam) ? statusParam : undefined;
  const category = params.get("category") ?? "";
  const locationId = params.get("location_id");
  const mine = params.get("mine") === "true";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const [search, setSearch] = useState(q);
  const debouncedSearch = useDebouncedValue(search, 350);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousPage = useRef(page);

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    setSearch(q);
  }, [q]);

  useEffect(() => {
    if (debouncedSearch === q) return;
    update({ q: debouncedSearch || undefined, page: undefined });
  }, [debouncedSearch, q, update]);

  useEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    resultsHeadingRef.current?.focus();
  }, [page]);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: endpoints.categories,
    staleTime: 10 * 60_000,
  });

  const locationsQuery = useQuery({
    queryKey: ["locations", "flat"],
    queryFn: () => endpoints.locations(),
    staleTime: 10 * 60_000,
  });

  const reportsQuery = useQuery({
    queryKey: ["reports", "browse", { type, status, category, locationId, mine, q, page }],
    queryFn: () =>
      endpoints.reports({
        type,
        status,
        category: category || undefined,
        location_id: locationId ? Number(locationId) : undefined,
        mine: mine || undefined,
        q: q || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const hasFilters = Boolean(type || status || category || locationId || mine || q);
  const total = reportsQuery.data?.total ?? 0;

  function clearFilters() {
    setSearch("");
    setParams(new URLSearchParams(), { replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Browse reports"
        description="Every lost and found report on campus. Use the filters to narrow things down, then open a report to see possible matches."
        actions={
          <Link to="/reports/new" className={buttonStyles("primary", "md")}>
            <NotePencil size={16} aria-hidden="true" />
            Report an item
          </Link>
        }
      />

      <section aria-label="Filters" className="surface-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="browse-search" className="mb-1.5 block text-xs font-medium text-ink">
              Search
            </label>
            <div className="relative">
              <MagnifyingGlass
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg"
              />
              <input
                id="browse-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Title or description, for example calculator"
                className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-muted-fg/80 transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-fg hover:bg-surface-sunken hover:text-ink"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink">Type</span>
            <SegmentedControl
              label="Report type"
              value={type ?? ""}
              options={[
                { value: "", label: "All" },
                { value: "LOST", label: "Lost" },
                { value: "FOUND", label: "Found" },
              ]}
              onChange={(value) => update({ type: value || undefined, page: undefined })}
            />
          </div>

          <button
            type="button"
            aria-pressed={mine}
            onClick={() => update({ mine: mine ? undefined : "true", page: undefined })}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
              mine
                ? "border-brand/30 bg-brand-soft text-brand-ink"
                : "border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-surface-muted",
            )}
          >
            <FunnelSimple size={15} aria-hidden="true" />
            My reports only
          </button>
        </div>

        <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="filter-category" className="mb-1.5 block text-xs font-medium text-ink">
              Category
            </label>
            <select
              id="filter-category"
              value={category}
              onChange={(event) => update({ category: event.target.value || undefined, page: undefined })}
              className={filterSelect}
            >
              <option value="">Any category</option>
              {(categoriesQuery.data ?? []).map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-status" className="mb-1.5 block text-xs font-medium text-ink">
              Status
            </label>
            <select
              id="filter-status"
              value={status ?? ""}
              onChange={(event) => update({ status: event.target.value || undefined, page: undefined })}
              className={filterSelect}
            >
              <option value="">Any status</option>
              {Object.entries(REPORT_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-location" className="mb-1.5 block text-xs font-medium text-ink">
              Location
            </label>
            <select
              id="filter-location"
              value={locationId ?? ""}
              onChange={(event) =>
                update({ location_id: event.target.value || undefined, page: undefined })
              }
              className={filterSelect}
            >
              <option value="">Any location</option>
              {(locationsQuery.data ?? []).map((location) => (
                <option key={location.id} value={location.id}>
                  {location.path}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={14} aria-hidden="true" />
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="results-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2
            id="results-heading"
            ref={resultsHeadingRef}
            tabIndex={-1}
            className="text-sm font-semibold text-ink outline-none"
          >
            {reportsQuery.isPending ? (
              "Loading reports..."
            ) : (
              <>
                {total} {total === 1 ? "report" : "reports"}
                {hasFilters && <span className="font-normal text-muted-fg"> matching your filters</span>}
              </>
            )}
          </h2>
          {reportsQuery.isFetching && !reportsQuery.isPending && (
            <span className="text-xs text-muted-fg" role="status">
              Updating results...
            </span>
          )}
        </div>

        {reportsQuery.isError ? (
          <ErrorState error={reportsQuery.error} onRetry={() => reportsQuery.refetch()} />
        ) : reportsQuery.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : reportsQuery.data.items.length === 0 ? (
          <EmptyState
            icon={<MagnifyingGlass size={22} aria-hidden="true" />}
            title="No reports match those filters"
            description="Try a different category or location, or clear the filters to see everything."
            action={
              hasFilters ? (
                <button type="button" onClick={clearFilters} className={buttonStyles("secondary", "sm")}>
                  Clear filters
                </button>
              ) : (
                <Link to="/reports/new" className={buttonStyles("primary", "sm")}>
                  Report an item
                </Link>
              )
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {reportsQuery.data.items.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}

        {reportsQuery.data && reportsQuery.data.pages > 1 && (
          <div className="mt-6">
            <Pagination
              page={reportsQuery.data.page}
              pages={reportsQuery.data.pages}
              total={reportsQuery.data.total}
              onPageChange={(nextPage) => update({ page: String(nextPage) })}
            />
          </div>
        )}
      </section>
    </div>
  );
}
