import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck } from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { errorMessage } from "@/api/errors";
import type { Match } from "@/api/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/format";

const claimSchema = z.object({
  proof: z
    .string()
    .trim()
    .min(3, "Add a detail the desk can check against the finder's note")
    .max(500, "Keep this under 500 characters"),
  note: z.string().max(500, "Keep this under 500 characters").optional(),
});

type ClaimValues = z.infer<typeof claimSchema>;

export interface ClaimDialogProps {
  open: boolean;
  onClose: () => void;
  match: Match | null;
}

export function ClaimDialog({ open, onClose, match }: ClaimDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClaimValues>({
    resolver: zodResolver(claimSchema),
    defaultValues: { proof: "", note: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ClaimValues) =>
      endpoints.createClaim({
        match_id: match!.id,
        answers: {
          hidden_detail: values.proof.trim(),
          note: values.note?.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Claim submitted", "The lost-and-found desk will compare your answer and reply.");
      queryClient.invalidateQueries({ queryKey: ["report"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error("Could not submit the claim", errorMessage(error));
    },
  });

  if (!match) return null;

  const lost = match.lost_report;
  const found = match.found_report;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Claim this item"
      description={`You are claiming "${lost.title}" and suggesting it is the item reported as found.`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="claim-form"
            loading={mutation.isPending || isSubmitting}
          >
            Submit claim
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-line bg-surface-muted p-3.5 text-sm">
          <p className="font-medium text-ink">{found.title}</p>
          <p className="mt-1 text-xs text-muted-fg">
            {found.category.label} · {found.location?.path ?? "location not given"} · found{" "}
            {formatDateTime(found.occurred_at)}
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-brand/25 bg-brand-soft/50 p-3.5 text-xs leading-relaxed text-brand-ink">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            The finder recorded a private detail when handing the item in. Type the same detail
            so the desk can verify the item is yours. Nothing you type here is shown to other
            students.
          </p>
        </div>

        <form
          id="claim-form"
          className="space-y-4"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          {mutation.isError && (
            <p role="alert" className="rounded-lg border border-danger/25 bg-danger-soft/50 px-3 py-2.5 text-sm text-danger-strong">
              {errorMessage(mutation.error)}
            </p>
          )}

          <Textarea
            id="claim-proof"
            label="A detail only the owner would know"
            hint="For example a scratch, a sticker, the wallpaper, or a name written inside."
            required
            rows={3}
            error={errors.proof?.message}
            data-autofocus
            {...register("proof")}
          />

          <Textarea
            id="claim-note"
            label="Anything else for the desk"
            hint="Optional. When you are free to collect the item, for example."
            rows={2}
            error={errors.note?.message}
            {...register("note")}
          />
        </form>
      </div>
    </Modal>
  );
}
