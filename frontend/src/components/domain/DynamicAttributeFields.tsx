import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { LockSimple } from "@phosphor-icons/react";
import type { CategoryField, ReportType } from "@/api/types";
import { Checkbox, Input, Select } from "@/components/ui/FormControls";
import type { ReportFormValues } from "@/lib/reportForm";

export interface DynamicAttributeFieldsProps {
  fields: CategoryField[];
  reportType: ReportType;
  register: UseFormRegister<ReportFormValues>;
  errors: FieldErrors<ReportFormValues>;
}

export function DynamicAttributeFields({
  fields,
  reportType,
  register,
  errors,
}: DynamicAttributeFieldsProps) {
  const attributeErrors = (errors.attributes ?? {}) as unknown as Record<
    string,
    { message?: string } | undefined
  >;

  const visible = fields.filter((field) => !(reportType === "FOUND" && field.is_hidden));

  if (visible.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-sm text-muted-fg">
        This category has no extra fields. The title and description carry the match.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {visible.map((field) => {
        const id = `attr-${field.key}`;
        const name = `attributes.${field.key}` as const;
        const error = attributeErrors[field.key]?.message;
        const required = field.is_required && !field.is_hidden;
        const adornment = field.is_hidden ? (
          <span className="inline-flex items-center gap-1 text-2xs font-medium text-accent-strong">
            <LockSimple size={11} aria-hidden="true" />
            Private
          </span>
        ) : undefined;

        if (field.type === "BOOL") {
          return (
            <Checkbox
              key={field.key}
              id={id}
              label={field.label}
              error={error}
              {...register(name)}
            />
          );
        }

        if (field.type === "SELECT") {
          return (
            <Select
              key={field.key}
              id={id}
              label={field.label}
              placeholder={field.placeholder ?? "Select an option"}
              options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
              error={error}
              required={required}
              labelAdornment={adornment}
              {...register(name)}
            />
          );
        }

        if (field.type === "NUMBER") {
          return (
            <Input
              key={field.key}
              id={id}
              label={field.label}
              type="number"
              inputMode="numeric"
              placeholder={field.placeholder ?? undefined}
              error={error}
              required={required}
              labelAdornment={adornment}
              {...register(name, {
                setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
              })}
            />
          );
        }

        return (
          <Input
            key={field.key}
            id={id}
            label={field.label}
            placeholder={field.placeholder ?? undefined}
            error={error}
            required={required}
            labelAdornment={adornment}
            hint={field.is_hidden ? undefined : "Used as a matching signal, shown to everyone."}
            {...register(name)}
          />
        );
      })}

      {reportType === "LOST" && fields.some((field) => field.is_hidden) && (
        <p className="flex items-start gap-2 rounded-lg border border-accent/25 bg-accent-soft/50 px-3 py-2.5 text-xs leading-relaxed text-accent-strong">
          <LockSimple size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Fields marked with the lock are for verification only. They are never shown publicly and
          only you and the lost-and-found desk can see them.
        </p>
      )}
    </div>
  );
}
