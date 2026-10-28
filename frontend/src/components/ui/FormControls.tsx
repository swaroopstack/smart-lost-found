import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors duration-150 " +
  "placeholder:text-muted-fg/70 hover:border-line-strong focus:border-brand focus:outline-none " +
  "focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-muted-fg";

const controlOk = "border-line";
const controlBad = "border-danger focus:border-danger focus:ring-danger/20";

interface FieldBase {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  containerClassName?: string;
  /** Extra content shown on the label row, e.g. "Optional". */
  labelAdornment?: ReactNode;
}

function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  containerClassName,
  labelAdornment,
  children,
}: FieldBase & { children: ReactNode }) {
  return (
    <div className={cn("space-y-1.5", containerClassName)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label">
          {label}
          {required && (
            <span className="ml-1 text-danger" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        {labelAdornment}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger-strong" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export type InputProps = FieldBase & Omit<InputHTMLAttributes<HTMLInputElement>, "id">;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, hint, error, required, containerClassName, labelAdornment, className, ...props },
  ref,
) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      containerClassName={containerClassName}
      labelAdornment={labelAdornment}
    >
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        aria-required={required || undefined}
        className={cn(control, "h-10", error ? controlBad : controlOk, className)}
        {...props}
      />
    </FieldShell>
  );
});

export type TextareaProps = FieldBase & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { id, label, hint, error, required, containerClassName, labelAdornment, className, rows = 4, ...props },
  ref,
) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      containerClassName={containerClassName}
      labelAdornment={labelAdornment}
    >
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        aria-required={required || undefined}
        className={cn(control, "py-2.5 leading-relaxed", error ? controlBad : controlOk, className)}
        {...props}
      />
    </FieldShell>
  );
});

export type SelectProps = FieldBase &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
  };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    id,
    label,
    hint,
    error,
    required,
    containerClassName,
    labelAdornment,
    className,
    options,
    placeholder,
    ...props
  },
  ref,
) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      containerClassName={containerClassName}
      labelAdornment={labelAdornment}
    >
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        aria-required={required || undefined}
        className={cn(control, "h-10 cursor-pointer pr-8", error ? controlBad : controlOk, className)}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

export type CheckboxProps = FieldBase &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type">;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { id, label, hint, error, containerClassName, className, ...props },
  ref,
) {
  return (
    <div className={cn("space-y-1.5", containerClassName)}>
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3",
          "transition-colors hover:border-line-strong has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/30",
        )}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-describedby={describedBy(id, hint, error)}
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line text-brand accent-brand",
            className,
          )}
          {...props}
        />
        <span className="text-sm text-ink">{label}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger-strong" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export type PasswordInputProps = Omit<InputProps, "type">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    const fallbackId = useId();
    const id = props.id || fallbackId;

    return (
      <div className="relative">
        <Input {...props} ref={ref} id={id} type={visible ? "text" : "password"} className="pr-11" />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1 top-[1.875rem] flex h-8 w-8 items-center justify-center rounded-md text-muted-fg transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          {visible ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    );
  },
);
