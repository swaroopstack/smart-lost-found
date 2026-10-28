import { useState, type FormEvent } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MagnifyingGlass, UsersThree, X } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { errorMessage } from "@/api/errors";
import type { Role, User } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { RoleBadge } from "@/components/domain/StatusBadges";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 15;

const ROLES: Array<{ value: Role; label: string }> = [
  { value: "STUDENT", label: "Student" },
  { value: "STAFF", label: "Staff" },
  { value: "ADMIN", label: "Admin" },
];

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pendingRole, setPendingRole] = useState<{ user: User; role: Role } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", { query, page }],
    queryFn: () =>
      endpoints.users({
        q: query || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const roleMutation = useMutation({
    mutationFn: ({ user, role }: { user: User; role: Role }) =>
      endpoints.updateUserRole(user.id, role),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Role updated", `${updated.full_name} is now ${updated.role.toLowerCase()}.`);
      setPendingRole(null);
    },
    onError: (error) => toast.error("Could not change the role", errorMessage(error)),
  });

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users and roles"
        description="Everyone with an account. Students can report and claim; staff review matches and claims; admins also manage roles and see the audit log."
        breadcrumbs={[{ label: "Desk dashboard", to: "/admin" }, { label: "Users" }]}
        actions={
          <Badge tone="neutral">
            {usersQuery.data?.total ?? 0} {(usersQuery.data?.total ?? 0) === 1 ? "account" : "accounts"}
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
          <label htmlFor="user-search" className="sr-only">
            Search users by name, email or roll number
          </label>
          <input
            id="user-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or roll number"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-muted-fg/70 hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setQuery("");
                setPage(1);
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-fg hover:bg-surface-sunken hover:text-ink"
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <p className="text-xs text-muted-fg">
        Your own role cannot be changed here, so you cannot lock yourself out of the desk.
      </p>

      {usersQuery.isError ? (
        <ErrorState error={usersQuery.error} onRetry={() => usersQuery.refetch()} />
      ) : usersQuery.isPending ? (
        <SkeletonRows rows={6} />
      ) : usersQuery.data.items.length === 0 ? (
        <EmptyState
          icon={<UsersThree size={22} aria-hidden="true" />}
          title="No accounts found"
          description={query ? `Nothing matches “${query}”. Try a different name or email.` : "No accounts exist yet."}
          action={
            query ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setQuery("");
                  setPage(1);
                }}
              >
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div
            role="region"
            aria-label="User accounts"
            tabIndex={0}
            className="surface-card overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
          >
            <table className="w-full min-w-[820px] text-left text-sm">
              <caption className="sr-only">Accounts, with role controls</caption>
              <thead className="border-b border-line bg-surface-muted text-xs text-muted-fg">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Person</th>
                  <th scope="col" className="px-4 py-3 font-medium">Role</th>
                  <th scope="col" className="px-4 py-3 font-medium">Department</th>
                  <th scope="col" className="px-4 py-3 font-medium">Roll number</th>
                  <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {usersQuery.data.items.map((user) => {
                  const isMe = me?.id === user.id;

                  return (
                    <tr key={user.id} className="transition-colors hover:bg-surface-muted/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink">{user.full_name}</span>
                          {isMe && (
                            <Badge tone="brand" size="sm">
                              You
                            </Badge>
                          )}
                          {!user.is_active && (
                            <Badge tone="danger" size="sm">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <span className="mt-0.5 block text-xs text-muted-fg">{user.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        {isMe ? (
                          <RoleBadge role={user.role} size="sm" />
                        ) : (
                          <label className="sr-only" htmlFor={`role-${user.id}`}>
                            Role for {user.full_name}
                          </label>
                        )}
                        {!isMe && (
                          <select
                            id={`role-${user.id}`}
                            value={user.role}
                            onChange={(event) => {
                              const role = event.target.value as Role;
                              if (role !== user.role) setPendingRole({ user, role });
                            }}
                            className="h-9 cursor-pointer rounded-lg border border-line bg-surface px-2 text-sm text-ink hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                          >
                            {ROLES.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink-soft">
                        {user.department ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                        {user.roll_number ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-fg">
                        {formatDate(user.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={usersQuery.data.page}
            pages={usersQuery.data.pages}
            total={usersQuery.data.total}
            onPageChange={setPage}
            itemLabel="accounts"
            itemLabelSingular="account"
          />
        </>
      )}

      <ConfirmDialog
        open={pendingRole !== null}
        onClose={() => setPendingRole(null)}
        onConfirm={async () => {
          if (!pendingRole) return;
          await roleMutation.mutateAsync(pendingRole);
        }}
        title="Change this person's role?"
        description={
          pendingRole
            ? `${pendingRole.user.full_name} will become ${pendingRole.role.toLowerCase()}. ${
                pendingRole.role === "ADMIN"
                  ? "Admins can manage users and see the audit log."
                  : pendingRole.role === "STAFF"
                    ? "Staff can review matches and claims."
                    : "Students can report items and submit claims."
              }`
            : ""
        }
        confirmLabel="Change role"
      >
        <p className="text-sm text-muted-fg">
          The change takes effect the next time they load a page. It is recorded in the audit log.
        </p>
      </ConfirmDialog>
    </div>
  );
}
