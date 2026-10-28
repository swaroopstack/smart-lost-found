import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { List, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { buttonStyles } from "@/components/ui/Button";
import { Brand } from "./Brand";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/browse?q=${encodeURIComponent(trimmed)}` : "/browse");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/75">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface-muted lg:hidden"
        >
          <List size={22} aria-hidden="true" />
        </button>

        <div className="lg:hidden">
          <Brand compact />
        </div>

        <form onSubmit={handleSearch} role="search" className="hidden min-w-0 flex-1 lg:block lg:max-w-md">
          <label htmlFor="global-search" className="sr-only">
            Search reports
          </label>
          <div className="relative">
            <MagnifyingGlass
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg"
            />
            <input
              id="global-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search lost and found reports"
              className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted-fg/80 transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
          <Link
            to="/reports/new"
            className={buttonStyles("primary", "sm", "hidden sm:inline-flex")}
          >
            <Plus size={16} aria-hidden="true" />
            Report an item
          </Link>
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
