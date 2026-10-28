import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: Array<SegmentOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-brand-soft text-brand-ink shadow-[inset_0_0_0_1px_rgba(13,148,136,0.25)]"
                : "text-muted-fg hover:bg-surface-muted hover:text-ink",
            )}
          >
            {option.label}
            {typeof option.count === "number" && (
              <span className="font-mono text-2xs text-muted-fg">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
