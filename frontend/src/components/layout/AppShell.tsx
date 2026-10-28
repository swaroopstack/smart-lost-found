import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { X } from "@phosphor-icons/react";
import { SidebarContent } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-ink-strong/45 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="drawer-enter absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-line bg-surface shadow-pop"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <X size={18} aria-hidden="true" />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-[260px]">
        <Topbar onMenu={() => setDrawerOpen(true)} />

        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className="container-page py-6 outline-none sm:py-8"
        >
          <Outlet />
        </main>

        <footer className="container-page pb-8">
          <p className="border-t border-line pt-4 text-xs text-muted-fg">
            CampusFind · Smart Lost &amp; Found for educational institutions
          </p>
        </footer>
      </div>
    </div>
  );
}
