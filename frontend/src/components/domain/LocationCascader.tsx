import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import type { LocationNode, LocationType } from "@/api/types";
import { cn } from "@/lib/cn";

const typeLabel: Record<LocationType, string> = {
  BUILDING: "building",
  BLOCK: "block",
  FLOOR: "floor",
  ROOM: "room",
  OTHER: "place",
};

function findPath(nodes: LocationNode[], id: number): LocationNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const childPath = findPath(node.children ?? [], id);
    if (childPath) return [node, ...childPath];
  }
  return null;
}

const selectClass =
  "h-10 w-full cursor-pointer rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors " +
  "hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export interface LocationCascaderProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
}

export function LocationCascader({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  required,
  optionalLabel = "Optional",
}: LocationCascaderProps) {
  const { data: tree, isPending, isError } = useQuery({
    queryKey: ["locations", "tree"],
    queryFn: endpoints.locationTree,
    staleTime: 10 * 60_000,
  });

  const [chain, setChain] = useState<LocationNode[]>([]);

  useEffect(() => {
    if (!tree) return;
    if (value === null || value === undefined) {
      setChain([]);
      return;
    }
    const path = findPath(tree, value);
    setChain(path ?? []);
  }, [tree, value]);

  const levels = useMemo(() => {
    if (!tree) return [];
    return [tree, ...chain.map((node) => node.children ?? [])];
  }, [tree, chain]);

  function handleSelect(index: number, raw: string) {
    const nextId = raw ? Number(raw) : null;
    if (nextId === null) {
      const nextChain = chain.slice(0, index);
      setChain(nextChain);
      onChange(nextChain.length ? nextChain[nextChain.length - 1].id : null);
      return;
    }

    const options = levels[index] ?? [];
    const node = options.find((candidate) => candidate.id === nextId);
    if (!node) return;

    const nextChain = [...chain.slice(0, index), node];
    setChain(nextChain);
    onChange(node.id);
  }

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={`${id}-0`} className="label">
          {label}
          {required && (
            <span className="ml-1 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {!required && <span className="text-2xs uppercase tracking-wide text-muted-fg">{optionalLabel}</span>}
      </div>

      {isPending ? (
        <div className="grid gap-2 sm:grid-cols-2" aria-hidden="true">
          <div className="skeleton h-10" />
          <div className="skeleton h-10" />
        </div>
      ) : isError ? (
        <p className="text-xs font-medium text-danger-strong" role="alert">
          The campus map could not be loaded. You can still submit the report without a location.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {levels.map((options, index) => {
            if (options.length === 0) return null;
            const first = options[0];
            return (
              <select
                key={index}
                id={index === 0 ? `${id}-0` : undefined}
                aria-label={index === 0 ? undefined : `${label}: select ${typeLabel[first.type]}`}
                aria-describedby={describedBy}
                value={chain[index]?.id ?? ""}
                onChange={(event) => handleSelect(index, event.target.value)}
                className={cn(selectClass, error && "border-danger focus:border-danger focus:ring-danger/20")}
              >
                <option value="">
                  {index === 0 ? "Select a building" : `Select a ${typeLabel[first.type]}`}
                </option>
                {options.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
            );
          })}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <p id={`${id}-hint`} className={cn("hint", error && "hidden")}>
          {chain.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={12} aria-hidden="true" className="shrink-0 text-brand-strong" />
              {chain.map((node) => node.name).join(" / ")}
            </span>
          ) : (
            (hint ?? "Pick the most specific place you can. You can change this later.")
          )}
        </p>
        {chain.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setChain([]);
              onChange(null);
            }}
            className="min-h-6 shrink-0 rounded px-2 py-1 text-xs font-medium text-brand-strong transition-colors hover:bg-brand-soft"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-danger-strong" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
