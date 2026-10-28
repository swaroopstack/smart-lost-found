import type { ComponentType } from "react";
import {
  BeerBottle,
  BookOpen,
  Calculator,
  Headphones,
  IdentificationCard,
  Key,
  Package,
  type IconProps,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

type IconComponent = ComponentType<IconProps>;

const iconMap: Record<string, IconComponent> = {
  "id-card": IdentificationCard,
  calculator: Calculator,
  bottle: BeerBottle,
  headphones: Headphones,
  book: BookOpen,
  key: Key,
  box: Package,
};

export interface CategoryIconProps {
  icon?: string | null;
  categoryKey?: string;
  size?: number;
  className?: string;
  /** Wraps the glyph in a tinted tile. */
  tile?: boolean;
}

export function CategoryIcon({ icon, categoryKey, size = 20, className, tile = false }: CategoryIconProps) {
  const Glyph = (icon && iconMap[icon]) || (categoryKey && iconMap[categoryKey]) || Package;

  if (!tile) {
    return <Glyph size={size} className={className} weight="regular" />;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-brand-soft text-brand-strong",
        size >= 40 ? "h-11 w-11" : "h-9 w-9",
        className,
      )}
    >
      <Glyph size={size} weight="regular" />
    </span>
  );
}
