import type { ReactNode } from "react";
import { ShieldCheck, SealCheck, Sparkle } from "@phosphor-icons/react";
import { BrandMark } from "./Brand";

const highlights = [
  {
    icon: Sparkle,
    title: "Match in seconds",
    body: "Location, time, description, attributes and photos are scored together the moment you report.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Secret details used for verification are never shown in public reports.",
  },
  {
    icon: SealCheck,
    title: "Verified hand-over",
    body: "Every ownership claim is reviewed by the lost-and-found desk before an item goes back.",
  },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-ink px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-brand/30 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <BrandMark size={38} />
          <span className="leading-tight">
            <span className="block text-lg font-semibold tracking-tight">CampusFind</span>
            <span className="block text-2xs font-medium uppercase tracking-[0.18em] text-white/60">
              Lost &amp; Found
            </span>
          </span>
        </div>

        <div className="relative max-w-lg">
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-brand-soft">
            Smart lost &amp; found
          </p>
          <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.1] tracking-tight">
            Lost something?
            <br />
            Let the campus find it.
          </h1>
          <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-white/70">
            One place for students, staff and the security desk to report, match and return items
            without guesswork.
          </p>

          <ul className="mt-9 space-y-5">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex gap-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-soft">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-white/60">
                      {item.body}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-white/45">
          Built for educational institutions · Never auto-returns an item
        </p>
      </aside>

      <main className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark size={34} />
            <span className="leading-tight">
              <span className="block text-base font-semibold tracking-tight text-ink-strong">
                CampusFind
              </span>
              <span className="block text-2xs font-medium uppercase tracking-[0.16em] text-muted-fg">
                Lost &amp; Found
              </span>
            </span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
