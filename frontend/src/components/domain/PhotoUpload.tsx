import { useEffect, useRef, useState } from "react";
import { ImageSquare, Trash, UploadSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface PhotoUploadProps {
  id?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  maxMb?: number;
  disabled?: boolean;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function PhotoUpload({ id = "photo", file, onChange, maxMb = 5, disabled }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    if (!ACCEPTED.includes(candidate.type)) {
      setError("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (candidate.size > maxMb * 1024 * 1024) {
      setError(`That image is larger than ${maxMb} MB. Please choose a smaller file.`);
      return;
    }
    setError(null);
    onChange(candidate);
  }

  function clear() {
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label" id={`${id}-label`}>
          Photo
        </span>
        <span className="text-2xs uppercase tracking-wide text-muted-fg">Optional</span>
      </div>

      <div
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative overflow-hidden rounded-lg border border-dashed bg-surface-muted transition-colors",
          dragging ? "border-brand bg-brand-soft/40" : "border-line-strong/70",
          disabled && "opacity-60",
        )}
      >
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Preview of the photo you selected"
              className="max-h-64 w-full object-contain"
            />
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              className="absolute right-2 top-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface/95 px-2.5 text-xs font-medium text-ink shadow-card transition-colors hover:bg-surface-sunken"
            >
              <Trash size={14} aria-hidden="true" />
              Remove
            </button>
          </div>
        ) : (
          <label
            htmlFor={id}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 px-6 py-9 text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
              <UploadSimple size={20} aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-ink">
              Drop a photo here, or <span className="text-brand-strong underline underline-offset-2">browse</span>
            </span>
            <span className="text-xs text-muted-fg">
              JPEG, PNG or WebP. Up to {maxMb} MB. A photo makes matching much more accurate.
            </span>
          </label>
        )}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          disabled={disabled}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger-strong" role="alert">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="hint flex items-center gap-1.5">
          <ImageSquare size={13} aria-hidden="true" />
          The photo is attached right after the report is created.
        </p>
      )}
    </div>
  );
}
