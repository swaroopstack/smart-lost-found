import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { useAuth } from "@/auth/AuthProvider";

export function NotificationBell() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: endpoints.unreadCount,
    refetchInterval: 60_000,
    enabled: Boolean(user),
  });

  const unread = data?.unread ?? 0;

  return (
    <Link
      to="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <Bell size={20} aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-accent-strong px-1 font-mono text-[10px] font-bold leading-[1.1rem] text-white"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
