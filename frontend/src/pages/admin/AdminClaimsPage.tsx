import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  LockSimple,
  ShieldCheck,
  XCircle,
} from "@phosphor-icons/react";
import { endpoints } from "@/api/endpoints";
import { errorMessage } from "@/api/errors";
import type { ClaimDetail, ClaimStatus } from "@/api/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, buttonStyles } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { Textarea } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { ClaimStatusBadge, RoleBadge } from "@/components/domain/StatusBadges";
import { formatDateTime, initials } from "@/lib/format";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 10;

function isClaimStatus(value: string | null): value is ClaimStatus {
  return value === "PENDING" || value === "APPROVED" || value === "REJECTED";
}

function answerLabel(key: string): string {
  if (key === "hidden_detail") return "Verification answer";
  if (key === "note" || key === "notes") return "Claimant's note";
  return key.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AdminClaimsPage() {
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  const status: ClaimStatus | undefined =
    statusParam === "ALL" ? undefined : isClaimStatus(statusParam) ? statusParam : "PENDING";
  const activeTab = statusParam === "ALL" ? "ALL" : (status ?? "PENDING");
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const toast = useToast();
  const queryClient = useQueryClient();

  const [decision, setDecision] = useState<{ claim: ClaimDetail; kind: "approve" | "reject" } | null>(
    null,
  );
  const [note, setNote] = useState("");

  function setFilter(nextStatus: ClaimStatus | "ALL", nextPage = 1) {
    const next = new URLSearchParams();
    next.set("status", nextStatus);
    if (nextPage > 1) next.set("page", String(nextPage));
    setParams(next, { replace: true });
  }

  const claimsQuery = useQuery({
    queryKey: ["admin", "claims", { status, page }],
    queryFn: () =>
      endpoints.adminClaims({
        status: status ?? undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const decisionMutation = useMutation({
    mutationFn: ({ claim, kind, noteText }: { claim: ClaimDetail; kind: "approve" | "reject"; noteText?: string }) =>
      kind === "approve"
        ? endpoints.approveClaim(claim.id, noteText)
        : endpoints.rejectClaim(claim.id, noteText),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "claims"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success(
        variables.kind === "approve" ? "Claim approved" : "Claim rejected",
        variables.kind === "approve"
          ? "The lost report is marked returned and the finder's report is closed. The claimant has been notified."
          : "The claimant has been notified with your note. Both reports stay as they are.",
      );
      setDecision(null);
      setNote("");
    },
    onError: (error) => toast.error("Could not save the decision", errorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Claim reviews"
        description="Every claim waits for a person. Check the claimant's answer against the item and the finder's report, then approve or reject."
        breadcrumbs={[{ label: "Desk dashboard", to: "/admin" }, { label: "Claim reviews" }]}
        actions={
          <Link to="/admin/matches" className={buttonStyles("secondary", "md")}>
            Match queue
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      />

      <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
        {(
          [
            { value: "PENDING", label: "Waiting" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
            { value: "ALL", label: "All" },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(tab.value)}
              className={cn(
                "h-9 flex-1 rounded-md px-3 text-sm font-medium transition-colors sm:flex-none",
                active
                  ? "bg-brand-strong text-white"
                  : "text-ink-soft hover:bg-surface-muted hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-accent/25 bg-accent-soft/40 px-4 py-3 text-sm text-accent-strong">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          Approving releases the item: the lost report becomes{" "}
          <span className="font-semibold">returned</span> and the found report is closed. Do it only
          after the claimant's answer and the item have been verified.
        </p>
      </div>

      {claimsQuery.isError ? (
        <ErrorState error={claimsQuery.error} onRetry={() => claimsQuery.refetch()} />
      ) : claimsQuery.isPending ? (
        <SkeletonRows rows={4} />
      ) : claimsQuery.data.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardText size={22} aria-hidden="true" />}
          title={status === "PENDING" ? "No claims waiting" : "No claims with this status"}
          description={
            status === "PENDING"
              ? "Every claim has been reviewed. New claims appear here as soon as a student submits one."
              : "Try another tab to see the claim history."
          }
          action={
            status !== "PENDING" ? (
              <button
                type="button"
                onClick={() => setFilter("PENDING")}
                className={buttonStyles("secondary", "sm")}
              >
                Show waiting claims
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="space-y-4">
            {claimsQuery.data.items.map((claim) => {
              const answers = Object.entries(claim.answers ?? {});

              return (
                <li key={claim.id} className="surface-card overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-mono text-xs font-semibold text-muted-fg">
                          Claim #{claim.id}
                        </h2>
                        <ClaimStatusBadge status={claim.status} size="sm" />
                      </div>
                      <p className="mt-1 text-sm text-ink">
                        Match{" "}
                        <Link
                          to={`/admin/matches/${claim.match_id}`}
                          className="font-semibold text-brand-strong hover:underline"
                        >
                          #{claim.match_id}
                        </Link>{" "}
                        · submitted {formatDateTime(claim.created_at)}
                      </p>
                    </div>

                    {claim.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setNote("");
                            setDecision({ claim, kind: "reject" });
                          }}
                          icon={<XCircle size={15} aria-hidden="true" />}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setNote("");
                            setDecision({ claim, kind: "approve" });
                          }}
                          icon={<CheckCircle size={15} aria-hidden="true" />}
                        >
                          Approve
                        </Button>
                      </div>
                    ) : (
                      claim.decided_at && (
                        <span className="text-xs text-muted-fg">
                          Reviewed {formatDateTime(claim.decided_at)}
                        </span>
                      )
                    )}
                  </div>

                  <div className="grid gap-4 p-4 sm:grid-cols-[15rem_1fr] sm:p-5">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-mono text-xs font-semibold text-ink-soft">
                          {initials(claim.claimant.full_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {claim.claimant.full_name}
                          </p>
                          <p className="truncate text-xs text-muted-fg">
                            {claim.claimant.department ?? "No department"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <RoleBadge role={claim.claimant.role} size="sm" />
                      </div>
                      <Link
                        to={`/admin/matches/${claim.match_id}`}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline"
                      >
                        Compare the two reports
                        <ArrowRight size={12} aria-hidden="true" />
                      </Link>
                    </div>

                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-fg">
                        <LockSimple size={13} aria-hidden="true" />
                        The claimant's answers
                      </p>

                      {answers.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-fg">No answers were recorded.</p>
                      ) : (
                        <dl className="mt-2 space-y-2">
                          {answers.map(([key, value]) => (
                            <div
                              key={key}
                              className={cn(
                                "rounded-lg border px-3 py-2",
                                key === "hidden_detail"
                                  ? "border-accent/25 bg-accent-soft/40"
                                  : "border-line bg-surface-muted",
                              )}
                            >
                              <dt className="text-2xs font-medium uppercase tracking-wide text-muted-fg">
                                {answerLabel(key)}
                              </dt>
                              <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-ink">
                                {displayValue(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      {claim.notes && claim.status !== "PENDING" && (
                        <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-soft">
                          <span className="font-medium text-ink">Your decision note: </span>
                          {claim.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <Pagination
            page={claimsQuery.data.page}
            pages={claimsQuery.data.pages}
            total={claimsQuery.data.total}
            onPageChange={(nextPage) => setFilter(status ?? "ALL", nextPage)}
            itemLabel="claims"
            itemLabelSingular="claim"
          />
        </>
      )}

      <ConfirmDialog
        open={decision !== null}
        onClose={() => setDecision(null)}
        onConfirm={async () => {
          if (!decision) return;
          if (decision.kind === "reject" && !note.trim()) {
            toast.error("Add a note", "Tell the claimant why the answer did not match.");
            throw new Error("note required");
          }
          await decisionMutation.mutateAsync({
            claim: decision.claim,
            kind: decision.kind,
            noteText: note.trim() || undefined,
          });
        }}
        title={decision?.kind === "reject" ? "Reject this claim?" : "Approve this claim?"}
        description={
          decision?.kind === "reject"
            ? "The claimant is notified with your note. The reports stay as they are, so they can try again with better details."
            : "The lost report is marked returned and the found report is closed. The claimant is notified. This cannot be undone from the app."
        }
        confirmLabel={decision?.kind === "reject" ? "Reject claim" : "Approve and release"}
        tone={decision?.kind === "reject" ? "danger" : "primary"}
      >
        <Textarea
          id="claim-note"
          label={decision?.kind === "reject" ? "Why is this being rejected?" : "Decision note"}
          hint={
            decision?.kind === "reject"
              ? "Required. The claimant sees this, so keep it factual and kind."
              : "Optional. For example: answered the roll number correctly."
          }
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          required={decision?.kind === "reject"}
        />
      </ConfirmDialog>
    </div>
  );
}
