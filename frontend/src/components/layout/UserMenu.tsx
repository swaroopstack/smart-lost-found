import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CaretDown, SignOut, UserCircle } from "@phosphor-icons/react";
import { useAuth } from "@/auth/AuthProvider";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!user) return null;

  function handleSignOut() {
    setOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="account-panel"
        className="flex h-10 items-center gap-2 rounded-lg px-1.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft font-mono text-2xs font-semibold text-brand-ink">
          {initials(user.full_name)}
        </span>
        <span className="hidden max-w-[9rem] truncate text-sm font-medium text-ink md:block">
          {user.full_name.split(" ")[0]}
        </span>
        <CaretDown size={12} aria-hidden="true" className="hidden text-muted-fg md:block" />
      </button>

      {open && (
        <div
          id="account-panel"
          className="absolute right-0 top-full z-40 mt-2 w-64 origin-top-right animate-scale-in rounded-xl border border-line bg-surface p-1.5 shadow-pop"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-ink-strong">{user.full_name}</p>
            <p className="truncate text-xs text-muted-fg">{user.email}</p>
            <p className="mt-1.5 inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-brand-ink">
              {user.role.toLowerCase()}
            </p>
          </div>

          <div className="my-1 h-px bg-line" />

          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-muted"
          >
            <UserCircle size={16} aria-hidden="true" className="text-muted-fg" />
            Your profile
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-danger-strong transition-colors hover:bg-danger-soft",
            )}
          >
            <SignOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
