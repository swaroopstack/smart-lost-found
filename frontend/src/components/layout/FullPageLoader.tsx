import { CircleNotch } from "@phosphor-icons/react";

export function FullPageLoader({ label = "Loading CampusFind" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-strong text-white">
        <CircleNotch size={24} className="animate-spin" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-muted-fg">{label}...</p>
    </div>
  );
}
