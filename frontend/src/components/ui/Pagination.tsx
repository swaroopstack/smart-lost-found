import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "./Button";

export interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  /** Used when total is 1. Defaults to the plural label without a trailing "s". */
  itemLabelSingular?: string;
}

export function Pagination({
  page,
  pages,
  total,
  onPageChange,
  itemLabel = "results",
  itemLabelSingular,
}: PaginationProps) {
  const label =
    total === 1 ? (itemLabelSingular ?? itemLabel.replace(/s$/, "")) : itemLabel;

  if (pages <= 1) {
    return total > 0 ? (
      <p className="text-xs text-muted-fg">
        {total} {label}
      </p>
    ) : null;
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center justify-between gap-3 border-t border-line pt-4 sm:flex-row"
    >
      <p className="text-xs text-muted-fg" aria-live="polite">
        Page <span className="font-mono font-medium text-ink">{page}</span> of{" "}
        <span className="font-mono font-medium text-ink">{pages}</span>
        <span className="mx-1.5 text-line-strong">|</span>
        {total} {label}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          icon={<CaretLeft size={14} aria-hidden="true" />}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
        >
          Next
          <CaretRight size={14} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
