import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Check,
  CheckCircle,
  HandHeart,
  LockSimple,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { errorMessage } from "@/api/errors";
import type { Category, ReportType } from "@/api/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/FormControls";
import { ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { CategoryIcon } from "@/components/domain/CategoryIcon";
import { DynamicAttributeFields } from "@/components/domain/DynamicAttributeFields";
import { LocationCascader } from "@/components/domain/LocationCascader";
import { PhotoUpload } from "@/components/domain/PhotoUpload";
import { cleanAttributes, emptyReportForm, reportFormSchema, type DraftShape, type ReportFormValues } from "@/lib/reportForm";
import { clearDraft, readDraft, writeDraft } from "@/lib/storage";
import { fromDateTimeLocal, nowDateTimeLocal } from "@/lib/format";
import { cn } from "@/lib/cn";

const STEPS = [
  { title: "What happened", short: "Type & category" },
  { title: "Describe the item", short: "Details" },
  { title: "Where and when", short: "Place & time" },
];

const TIPS: Array<{ heading: string; points: string[] }> = [
  {
    heading: "A good report gets better matches",
    points: [
      "Pick the category that fits best. It changes which detail fields you see.",
      "Lost and found reports are matched against each other automatically.",
      "You can edit or close a report later from My reports.",
    ],
  },
  {
    heading: "More detail, better matches",
    points: [
      "The public description is visible to everyone on campus.",
      "The private detail is never shown publicly. It is used to verify a claim.",
      "A photo is compared with the photo on the other report.",
    ],
  },
  {
    heading: "Location and time carry the most weight",
    points: [
      "Location counts for 30% of a match, time for 25%.",
      "Pick the most specific place you can, even if it is only the building.",
      "Found an item? Record where you handed it in so the owner knows where to collect.",
    ],
  },
];

function TypeOption({
  value,
  current,
  onSelect,
  title,
  body,
  icon,
}: {
  value: ReportType;
  current: ReportType;
  onSelect: (value: ReportType) => void;
  title: string;
  body: string;
  icon: ReactNode;
}) {
  const selected = value === current;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      className={cn(
        "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors duration-150",
        selected
          ? "border-brand bg-brand-soft/50 ring-1 ring-brand/30"
          : "border-line bg-surface hover:border-line-strong hover:bg-surface-muted",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          selected ? "bg-brand-strong text-white" : "bg-surface-sunken text-ink-soft",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold text-ink-strong">{title}</span>
      <span className="text-xs leading-relaxed text-muted-fg">{body}</span>
      {selected && (
        <CheckCircle size={18} weight="fill" className="absolute right-3 top-3 text-brand" aria-hidden="true" />
      )}
    </button>
  );
}

function CategoryOption({
  category,
  selected,
  onSelect,
}: {
  category: Category;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex items-center gap-3 rounded-lg border p-3 text-left transition-colors duration-150",
        selected
          ? "border-brand bg-brand-soft/50 ring-1 ring-brand/30"
          : "border-line bg-surface hover:border-line-strong hover:bg-surface-muted",
      )}
    >
      <CategoryIcon icon={category.icon} categoryKey={category.key} size={18} tile />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{category.label}</span>
        <span className="block truncate text-2xs text-muted-fg">
          {category.field_count > 0 ? `${category.field_count} detail fields` : "No extra fields"}
        </span>
      </span>
      {selected && <CheckCircle size={16} weight="fill" className="shrink-0 text-brand" aria-hidden="true" />}
    </button>
  );
}

export function NewReportPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const initialType: ReportType = params.get("type") === "FOUND" ? "FOUND" : "LOST";

  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<DraftShape | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const stepRef = useRef(step);
  stepRef.current = step;
  const draftTimer = useRef<number | undefined>(undefined);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    reset,
    getValues,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: { ...emptyReportForm, type: initialType, occurred_at: nowDateTimeLocal() },
    mode: "onBlur",
  });

  const type = watch("type");
  const categoryKey = watch("category_key");
  const title = watch("title") ?? "";
  const description = watch("public_description") ?? "";
  const privateDetail = watch("hidden_detail") ?? "";
  const locationId = watch("location_id");
  const depositedLocationId = watch("deposited_location_id");
  const occurredAt = watch("occurred_at");

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: endpoints.categories,
    staleTime: 10 * 60_000,
  });

  const metaQuery = useQuery({
    queryKey: ["meta"],
    queryFn: endpoints.meta,
    staleTime: 30 * 60_000,
  });

  const fieldsQuery = useQuery({
    queryKey: ["category-fields", categoryKey],
    queryFn: () => endpoints.categoryFields(categoryKey),
    enabled: Boolean(categoryKey),
    staleTime: 10 * 60_000,
  });

  const fields = fieldsQuery.data ?? [];
  const maxUploadMb = metaQuery.data?.uploads.max_upload_mb ?? 5;

  /* Restore a draft once, after mount. */
  useEffect(() => {
    const draft = readDraft<DraftShape>();
    if (!draft?.values) return;
    reset({ ...emptyReportForm, ...draft.values });
    setStep(Math.min(2, Math.max(0, draft.step ?? 0)));
    setDraftNotice(draft);
  }, [reset]);

  /* Autosave the draft 700ms after the last change. */
  useEffect(() => {
    const subscription = watch((values) => {
      window.clearTimeout(draftTimer.current);
      draftTimer.current = window.setTimeout(() => {
        writeDraft({
          values: values as ReportFormValues,
          step: stepRef.current,
          savedAt: new Date().toISOString(),
        });
      }, 700);
    });

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(draftTimer.current);
    };
  }, [watch]);

  function discardDraft() {
    clearDraft();
    setDraftNotice(null);
    setPhoto(null);
    setAttemptedSubmit(false);
    reset({ ...emptyReportForm, type: initialType, occurred_at: nowDateTimeLocal() });
    setStep(0);
  }

  function selectCategory(key: string) {
    if (key !== categoryKey) {
      setValue("category_key", key, { shouldValidate: true });
      setValue("attributes", {});
      clearErrors("attributes");
    }
  }

  function validateRequiredAttributes(): boolean {
    let firstInvalid: string | null = null;
    const values = getValues("attributes") ?? {};

    for (const field of fields) {
      if (type === "FOUND" && field.is_hidden) continue;
      if (!field.is_required) continue;
      const value = (values as Record<string, unknown>)[field.key];
      if (value === undefined || value === null || value === "" || (typeof value === "number" && Number.isNaN(value))) {
        setError(`attributes.${field.key}` as const, {
          type: "required",
          message: "This field is required",
        });
        if (!firstInvalid) firstInvalid = `attr-${field.key}`;
      }
    }

    if (firstInvalid) {
      window.setTimeout(() => document.getElementById(firstInvalid!)?.focus(), 0);
      return false;
    }
    return true;
  }

  async function goNext() {
    if (step === 0) {
      const ok = await trigger(["type", "category_key"]);
      if (ok) setStep(1);
      return;
    }
    if (step === 1) {
      const ok = await trigger(["title", "public_description", "hidden_detail"]);
      if (!validateRequiredAttributes()) return;
      if (ok) setStep(2);
    }
  }

  async function onSubmit(values: ReportFormValues) {
    setAttemptedSubmit(true);
    setSubmitError(null);

    if (!validateRequiredAttributes()) {
      setStep(1);
      return;
    }

    const visibleKeys = new Set(
      fields.filter((field) => !(values.type === "FOUND" && field.is_hidden)).map((field) => field.key),
    );
    const attributes = Object.fromEntries(
      Object.entries(cleanAttributes(values.attributes ?? {})).filter(([key]) => visibleKeys.has(key)),
    );

    try {
      const report = await endpoints.createReport({
        type: values.type,
        category_key: values.category_key,
        title: values.title.trim(),
        public_description: values.public_description?.trim() || null,
        hidden_detail: values.hidden_detail?.trim() || null,
        attributes,
        location_id: values.location_id,
        occurred_at: fromDateTimeLocal(values.occurred_at),
        deposited_location_id: values.type === "FOUND" ? values.deposited_location_id : null,
      });

      if (photo) {
        try {
          await endpoints.uploadPhoto(report.id, photo);
        } catch (error) {
          toast.error(
            "Report created, photo skipped",
            errorMessage(error),
          );
        }
      }

      clearDraft();
      toast.success("Report created", "Matching has already run. Open the report to see possible matches.");
      navigate(`/reports/${report.id}`, { replace: true });
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  }

  function onInvalid(formErrors: typeof errors) {
    setAttemptedSubmit(true);
    if (formErrors.type || formErrors.category_key) {
      setStep(0);
      return;
    }
    if (
      formErrors.title ||
      formErrors.public_description ||
      formErrors.hidden_detail ||
      formErrors.attributes
    ) {
      setStep(1);
      return;
    }
    if (formErrors.occurred_at) {
      setStep(2);
    }
  }

  const selectedCategory = categoriesQuery.data?.find((item) => item.key === categoryKey);
  const stepErrors = Object.entries(errors).filter(([key]) => key !== "attributes");
  const attributeErrorCount = Object.keys(
    (errors.attributes ?? {}) as unknown as Record<string, unknown>,
  ).length;
  const hasErrors = stepErrors.length > 0 || attributeErrorCount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report an item"
        description="Three short steps. You can go back at any point, and a draft is saved on this device."
        breadcrumbs={[{ label: "Overview", to: "/" }, { label: "Report an item" }]}
        actions={
          <Link to="/browse" className={buttonStyles("secondary", "md")}>
            Cancel
          </Link>
        }
      />

      {draftNotice && (
        <div className="flex flex-col gap-2 rounded-lg border border-info/25 bg-info-soft/60 px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold">Draft restored.</span> Your unfinished report was saved on
            this device. Photos are not stored in drafts.
          </p>
          <button
            type="button"
            onClick={discardDraft}
            className="shrink-0 self-start rounded-md px-2 py-1 text-xs font-semibold text-brand-strong hover:bg-surface/60 sm:self-auto"
          >
            Start over
          </button>
        </div>
      )}

      <ol aria-label="Report progress" className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((item, index) => {
          const complete = index < step;
          const active = index === step;
          return (
            <li key={item.title} className="flex flex-1 items-center gap-2 sm:gap-3">
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold transition-colors",
                  complete && "bg-brand-strong text-white",
                  active && "border-2 border-brand bg-surface text-brand-strong",
                  !complete && !active && "border border-line bg-surface text-muted-fg",
                )}
              >
                {complete ? <Check size={14} weight="bold" aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate text-xs font-semibold sm:text-sm",
                    active ? "text-ink-strong" : "text-muted-fg",
                  )}
                >
                  {item.title}
                </span>
                <span className="sr-only">
                  {complete ? "completed" : active ? "current step" : "upcoming"}
                </span>
              </span>
              {index < STEPS.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {attemptedSubmit && hasErrors && (
            <div
              role="alert"
              tabIndex={-1}
              className="rounded-lg border border-danger/25 bg-danger-soft/50 px-4 py-3 text-sm text-danger-strong"
            >
              <p className="font-semibold">Some details still need attention.</p>
              <p className="mt-0.5">
                Check the highlighted fields
                {attributeErrorCount > 0 ? `, including ${attributeErrorCount} extra detail field${attributeErrorCount === 1 ? "" : "s"}` : ""}
                .
              </p>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-soft/50 px-4 py-3 text-sm text-danger-strong"
            >
              <WarningCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{submitError}</p>
            </div>
          )}

          <form id="report-form" onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
            <div className="surface-card p-5 sm:p-6">
              {step === 0 && (
                <div className="space-y-6">
                  <fieldset>
                    <legend className="text-base font-semibold text-ink-strong">
                      Did you lose it, or find it?
                    </legend>
                    <p className="mt-1 text-sm text-muted-fg">
                      This decides which questions we ask and who gets notified.
                    </p>
                    <div role="radiogroup" aria-label="Report type" className="mt-3 grid gap-3 sm:grid-cols-2">
                      <TypeOption
                        value="LOST"
                        current={type}
                        onSelect={(value) => setValue("type", value, { shouldValidate: true })}
                        title="I lost something"
                        body="We will look for found reports that match it."
                        icon={<WarningCircle size={20} aria-hidden="true" />}
                      />
                      <TypeOption
                        value="FOUND"
                        current={type}
                        onSelect={(value) => setValue("type", value, { shouldValidate: true })}
                        title="I found something"
                        body="Help the owner prove it is theirs and get it back."
                        icon={<HandHeart size={20} aria-hidden="true" />}
                      />
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="text-base font-semibold text-ink-strong">What kind of item?</legend>
                    <p className="mt-1 text-sm text-muted-fg">
                      Pick the closest category. It changes the detail fields in the next step.
                    </p>

                    {categoriesQuery.isPending ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-hidden="true">
                        {Array.from({ length: 7 }).map((_, index) => (
                          <div key={index} className="skeleton h-[4.25rem]" />
                        ))}
                      </div>
                    ) : categoriesQuery.isError ? (
                      <div className="mt-3">
                        <ErrorState error={categoriesQuery.error} onRetry={() => categoriesQuery.refetch()} />
                      </div>
                    ) : (
                      <div role="radiogroup" aria-label="Category" className="mt-3 grid gap-2 sm:grid-cols-2">
                        {(categoriesQuery.data ?? []).map((category) => (
                          <CategoryOption
                            key={category.key}
                            category={category}
                            selected={category.key === categoryKey}
                            onSelect={() => selectCategory(category.key)}
                          />
                        ))}
                      </div>
                    )}
                    {errors.category_key && (
                      <p className="mt-2 text-xs font-medium text-danger-strong" role="alert">
                        {errors.category_key.message}
                      </p>
                    )}
                  </fieldset>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-ink-strong">Describe the item</h2>
                    <p className="mt-1 text-sm text-muted-fg">
                      Plain language works best. Imagine you are describing it to a friend.
                    </p>
                  </div>

                  <div className="relative">
                    <Input
                      id="report-title"
                      label="Title"
                      placeholder={type === "LOST" ? "Black Casio calculator" : "Found a blue water bottle"}
                      required
                      maxLength={140}
                      error={errors.title?.message}
                      hint="One line. Brand, colour and item type are the most useful words."
                      {...register("title")}
                    />
                    <span className="pointer-events-none absolute right-0 top-0 font-mono text-2xs text-muted-fg">
                      {title.length}/140
                    </span>
                  </div>

                  <div className="relative">
                    <Textarea
                      id="report-description"
                      label="Public description"
                      placeholder="Where you last saw it, what it looks like, any distinguishing marks that are safe to share."
                      rows={4}
                      maxLength={2000}
                      error={errors.public_description?.message}
                      hint="Shown to everyone. Do not put the secret verification detail here."
                      {...register("public_description")}
                    />
                    <span className="pointer-events-none absolute right-0 top-0 font-mono text-2xs text-muted-fg">
                      {description.length}/2000
                    </span>
                  </div>

                  <div className="relative">
                    <Textarea
                      id="report-private"
                      label={type === "LOST" ? "Private detail only you would know" : "A detail only the owner would know"}
                      placeholder={
                        type === "LOST"
                          ? "A scratch on the back, a sticker inside the lid, the wallpaper on the lock screen..."
                          : "The wallpaper, a name written inside, a small crack on the corner..."
                      }
                      rows={3}
                      maxLength={500}
                      error={errors.hidden_detail?.message}
                      hint="Never shown publicly. Used to verify an ownership claim and as a matching signal."
                      {...register("hidden_detail")}
                    />
                    <span className="pointer-events-none absolute right-0 top-0 font-mono text-2xs text-muted-fg">
                      {privateDetail.length}/500
                    </span>
                  </div>

                  {fieldsQuery.isError ? (
                    <ErrorState
                      error={fieldsQuery.error}
                      onRetry={() => fieldsQuery.refetch()}
                    />
                  ) : fieldsQuery.isPending && categoryKey ? (
                    <div className="space-y-3" aria-hidden="true">
                      <div className="skeleton h-10" />
                      <div className="skeleton h-10" />
                    </div>
                  ) : (
                    <DynamicAttributeFields
                      fields={fields}
                      reportType={type}
                      register={register}
                      errors={errors}
                    />
                  )}

                  <PhotoUpload file={photo} onChange={setPhoto} maxMb={maxUploadMb} />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-semibold text-ink-strong">Where and when</h2>
                    <p className="mt-1 text-sm text-muted-fg">
                      Location and time are the two strongest matching signals.
                    </p>
                  </div>

                  <LocationCascader
                    id="report-location"
                    label={type === "LOST" ? "Where did you last have it?" : "Where did you find it?"}
                    value={locationId ?? null}
                    onChange={(value) => setValue("location_id", value, { shouldDirty: true })}
                    hint="Building, block, floor or room. The more specific, the better."
                  />

                  <div className="relative">
                    <Input
                      id="report-occurred-at"
                      label={type === "LOST" ? "When did you notice it was missing?" : "When did you find it?"}
                      type="datetime-local"
                      required
                      max={nowDateTimeLocal()}
                      error={errors.occurred_at?.message}
                      hint="Local time. It cannot be in the future."
                      {...register("occurred_at")}
                    />
                    <CalendarBlank
                      size={15}
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-[2.4rem] text-muted-fg"
                    />
                  </div>

                  {type === "FOUND" && (
                    <LocationCascader
                      id="report-deposited"
                      label="Where did you hand it in?"
                      value={depositedLocationId ?? null}
                      onChange={(value) => setValue("deposited_location_id", value, { shouldDirty: true })}
                      hint="The desk or office holding the item now. Leave blank if you still have it."
                      optionalLabel="Optional"
                    />
                  )}

                  <div className="rounded-lg border border-line bg-surface-muted p-4">
                    <h3 className="text-sm font-semibold text-ink-strong">Review</h3>
                    <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
                      <dt className="text-muted-fg">Type</dt>
                      <dd className="font-medium text-ink">{type === "LOST" ? "Lost item" : "Found item"}</dd>
                      <dt className="text-muted-fg">Category</dt>
                      <dd className="font-medium text-ink">{selectedCategory?.label ?? "Not chosen"}</dd>
                      <dt className="text-muted-fg">Title</dt>
                      <dd className="break-words font-medium text-ink">{title || "Not filled in"}</dd>
                      <dt className="text-muted-fg">When</dt>
                      <dd className="font-medium text-ink">
                        {occurredAt ? occurredAt.replace("T", " · ") : "Not set"}
                      </dd>
                      <dt className="text-muted-fg">Photo</dt>
                      <dd className="font-medium text-ink">
                        {photo ? `Will be attached (${(photo.size / 1024).toFixed(0)} KB)` : "None"}
                      </dd>
                      <dt className="text-muted-fg">Private detail</dt>
                      <dd className="font-medium text-ink">
                        {privateDetail.trim() ? "Provided, hidden from the public" : "Not provided"}
                      </dd>
                    </dl>
                    <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted-fg">
                      Matching runs the moment you submit. You will be taken to the report, where any
                      possible matches are listed.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </form>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0 || isSubmitting}
              icon={<ArrowLeft size={16} aria-hidden="true" />}
            >
              Back
            </Button>

            {step < 2 ? (
              <Button type="button" onClick={goNext} disabled={isSubmitting}>
                Continue
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" form="report-form" loading={isSubmitting}>
                <Check size={16} aria-hidden="true" />
                Create report
              </Button>
            )}
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="surface-card p-5">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand-strong">
                <Sparkle size={14} aria-hidden="true" />
                Good to know
              </p>
              <h2 className="mt-2 text-sm font-semibold text-ink-strong">{TIPS[step].heading}</h2>
              <ul className="mt-3 space-y-2.5">
                {TIPS[step].points.map((point) => (
                  <li key={point} className="flex gap-2 text-xs leading-relaxed text-muted-fg">
                    <Check size={13} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-accent/25 bg-accent-soft/40 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-strong">
                <LockSimple size={14} aria-hidden="true" />
                Privacy promise
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                Private verification details are stored apart from the public report. They are
                never included in public lists or match suggestions, and other students never see
                them.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
