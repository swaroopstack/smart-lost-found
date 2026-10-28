import type { ComponentType } from "react";
import {
  ArrowsLeftRight,
  ClipboardText,
  House,
  MagnifyingGlass,
  NotePencil,
  Scroll,
  SquaresFour,
  UserCircle,
  UsersThree,
  Bell,
  type IconProps,
} from "@phosphor-icons/react";
import type { Role } from "@/api/types";

export type NavIcon = ComponentType<IconProps>;

export interface NavItem {
  to: string;
  label: string;
  icon: NavIcon;
  end?: boolean;
  roles?: Role[];
  badge?: "notifications";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Discover",
    items: [
      { to: "/", label: "Overview", icon: House, end: true },
      { to: "/browse", label: "Browse reports", icon: MagnifyingGlass },
      { to: "/reports/new", label: "Report an item", icon: NotePencil },
    ],
  },
  {
    label: "My activity",
    items: [
      { to: "/my-reports", label: "My reports", icon: ClipboardText },
      { to: "/my-claims", label: "My claims", icon: ArrowsLeftRight },
      { to: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
      { to: "/profile", label: "Profile", icon: UserCircle },
    ],
  },
  {
    label: "Lost & found desk",
    items: [
      { to: "/admin", label: "Dashboard", icon: SquaresFour, end: true, roles: ["STAFF", "ADMIN"] },
      { to: "/admin/matches", label: "Match queue", icon: ArrowsLeftRight, roles: ["STAFF", "ADMIN"] },
      { to: "/admin/claims", label: "Claim reviews", icon: ClipboardText, roles: ["STAFF", "ADMIN"] },
      { to: "/admin/users", label: "Users", icon: UsersThree, roles: ["ADMIN"] },
      { to: "/admin/audit", label: "Audit log", icon: Scroll, roles: ["ADMIN"] },
    ],
  },
];

export function visibleNavGroups(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
