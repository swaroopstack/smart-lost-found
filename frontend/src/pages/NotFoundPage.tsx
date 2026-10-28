import { Link, useLocation } from "react-router-dom";
import { Compass, House, MagnifyingGlass } from "@phosphor-icons/react";
import { buttonStyles } from "@/components/ui/Button";

export function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center sm:py-24">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
        <Compass size={26} aria-hidden="true" />
      </div>

      <p className="mt-5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted-fg">
        404 · Not found
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-strong">
        We could not find that page
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-fg">
        The address may be mistyped, or the page may have moved. Nothing was lost from your account.
      </p>
      <p className="mt-3 max-w-full truncate rounded-md bg-surface-sunken px-3 py-1.5 font-mono text-xs text-ink-soft">
        {location.pathname}
        {location.search}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link to="/" className={buttonStyles("primary", "md")}>
          <House size={16} aria-hidden="true" />
          Go to overview
        </Link>
        <Link to="/browse" className={buttonStyles("secondary", "md")}>
          <MagnifyingGlass size={16} aria-hidden="true" />
          Browse reports
        </Link>
      </div>
    </div>
  );
}
