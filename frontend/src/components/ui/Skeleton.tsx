import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="skeleton h-3.5"
          style={{ width: index === lines - 1 ? "62%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="surface-card overflow-hidden" aria-hidden="true">
      <div className="skeleton h-40 w-full rounded-none" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-3.5 w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="surface-card divide-y divide-line" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
          <div className="skeleton h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

export function LoadingRegion({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {label}
    </div>
  );
}
