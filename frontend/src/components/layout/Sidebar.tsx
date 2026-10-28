import { useQuery } from "@tanstack/react-query";
import { Link, NavLink } from "react-router-dom";
import { SignOut, Lifebuoy } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthProvider";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Brand } from "./Brand";
import { visibleNavGroups } from "./nav";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: endpoints.unreadCount,
    refetchInterval: 60_000,
    enabled: Boolean(user),
  });

  if (!user) return null;

  const groups = visibleNavGroups(user.role);
  const unreadCount = unread?.unread ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-6">
        <Brand />
      </div>

      <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.14em] text-muted-fg">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const showBadge = item.badge === "notifications" && unreadCount > 0;

                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      aria-label={
                        showBadge ? `${item.label}, ${unreadCount} unread` : undefined
                      }
                      className={({ isActive }) =>
                        cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                          isActive
                            ? "bg-brand-soft text-brand-ink"
                            : "text-ink-soft hover:bg-surface-muted hover:text-ink",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand transition-opacity",
                              isActive ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <Icon size={18} weight={isActive ? "fill" : "regular"} aria-hidden="true" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {showBadge && (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-strong px-1.5 py-0.5 font-mono text-2xs font-semibold text-white">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <div className="mb-3 rounded-lg border border-line bg-surface-muted p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Lifebuoy size={14} aria-hidden="true" className="text-brand-strong" />
            Need help?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-fg">
            Visit the Security Office in the Main Block, or call the desk during college hours.
          </p>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg px-1 py-1">
          <Link
            to="/profile"
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-surface-muted"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft font-mono text-xs font-semibold text-brand-ink">
              {initials(user.full_name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{user.full_name}</span>
              <span className="block truncate text-2xs uppercase tracking-wide text-muted-fg">
                {user.role.toLowerCase()}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-danger-soft hover:text-danger-strong"
          >
            <SignOut size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
