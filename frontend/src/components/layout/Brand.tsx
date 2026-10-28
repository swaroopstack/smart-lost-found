import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl bg-brand-strong text-white shadow-card"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" width={size * 0.62} height={size * 0.62} fill="none">
        <path
          d="M13 10.5a4.5 4.5 0 1 1 5.6 4.35l3.05 3.05a1.5 1.5 0 0 1-2.12 2.12l-3.05-3.05A4.5 4.5 0 0 1 13 10.5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="14.5" cy="10.5" r="1.6" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        className,
      )}
    >
      <BrandMark size={compact ? 32 : 36} />
      <span className="leading-tight">
        <span className="block text-[1.0625rem] font-semibold tracking-tight text-ink-strong">
          CampusFind
        </span>
        <span className="block text-2xs font-medium uppercase tracking-[0.16em] text-muted-fg">
          Lost &amp; Found
        </span>
      </span>
    </Link>
  );
}
