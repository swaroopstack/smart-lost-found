import { useState, type FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MagnifyingGlass, Scroll, X } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 20;

function MetaCell({ meta }: { meta: Record<string, unknown> }) {
  const entries = Object.entries(meta);

  if (entries.length === 0) {
    return <span className="text-xs text-muted-fg">—</span>;
  }

  const preview = entries
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");

  return (
    <details className="max-w-xs">
      <summary className="cursor-pointer truncate text-xs text-ink-soft hover:text-ink">
        {preview}
        {entries.length > 2 ? ` · +${entries.length - 2}` : ""}
      </summary>
      <pre className="mt-1.5 max-h-48 overflow-auto rounded-lg border border-line bg-surface-muted p-2 text-2xs leading-relaxed text-ink-soft">
        {JSON.stringify(meta, null, 2)}
      </pre>
    </details>
  );
}

export function AdminAuditPage() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const auditQuery = useQuery({
    queryKey: ["admin", "audit", { action, page }],
    queryFn: () =>
      endpoints.auditLog({
        action: action || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setAction(search.trim());
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every decision that changes a report, match, claim or role. Entries are append-only and identify the person who made the change."
        breadcrumbs={[{ label: "Desk dashboard", to: "/admin" }, { label: "Audit log" }]}
        actions={
          <Badge tone="neutral">
            {auditQuery.data?.total ?? 0} {(auditQuery.data?.total ?? 0) === 1 ? "entry" : "entries"}
          </Badge>
        }
      />

      <form onSubmit={submitSearch} role="search" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg"
            aria-hidden="true"
          />
          <label htmlFor="audit-action" className="sr-only">
            Filter by action
          </label>
          <input
            id="audit-action"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by action, e.g. claim.approve or match.reject"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 font-mono text-sm text-ink placeholder:font-sans placeholder:text-muted-fg/70 hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setAction("");
                setPage(1);
              }}
              aria-label="Clear filter"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-fg hover:bg-surface-sunken hover:text-ink"
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {auditQuery.isError ? (
        <ErrorState error={auditQuery.error} onRetry={() => auditQuery.refetch()} />
      ) : auditQuery.isPending ? (
        <SkeletonRows rows={8} />
      ) : auditQuery.data.items.length === 0 ? (
        <EmptyState
          icon={<Scroll size={22} aria-hidden="true" />}
          title={action ? "No entries for that action" : "Nothing recorded yet"}
          description={
            action
              ? "Action names are exact, for example claim.approve. Clear the filter to see everything."
              : "Decisions appear here as soon as staff confirm matches, review claims or change roles."
          }
          action={
            action ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setAction("");
                  setPage(1);
                }}
              >
                Clear filter
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div
            role="region"
            aria-label="Audit entries"
            tabIndex={0}
            className="surface-card overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
          >
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Append-only audit trail</caption>
              <thead className="border-b border-line bg-surface-muted text-xs text-muted-fg">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">When</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actor</th>
                  <th scope="col" className="px-4 py-3 font-medium">Action</th>
                  <th scope="col" className="px-4 py-3 font-medium">Entity</th>
                  <th scope="col" className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {auditQuery.data.items.map((entry) => (
                  <tr key={entry.id} className="align-top transition-colors hover:bg-surface-muted/60">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-fg">
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                      {entry.actor_id ? `#${entry.actor_id}` : "system"}
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-ink">
                        {entry.action}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      {entry.entity ? (
                        <>
                          <span className="capitalize">{entry.entity}</span>
                          {entry.entity_id !== null && (
                            <span className="ml-1 font-mono text-muted-fg">#{entry.entity_id}</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <MetaCell meta={entry.meta ?? {}} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={auditQuery.data.page}
            pages={auditQuery.data.pages}
            total={auditQuery.data.total}
            onPageChange={setPage}
            itemLabel="entries"
            itemLabelSingular="entry"
          />
        </>
      )}
    </div>
  );
}
