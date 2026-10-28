import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { errorMessage } from "@/api/errors";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong/60 bg-surface/60 px-6 py-14 text-center ${className ?? ""}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink-strong">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-fg">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center rounded-xl border border-danger/20 bg-danger-soft/40 px-6 py-12 text-center ${className ?? ""}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger-strong">
        <WarningCircle size={24} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink-strong">Something went wrong</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-fg">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
