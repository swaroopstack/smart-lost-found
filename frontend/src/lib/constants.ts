import type { ClaimStatus, MatchBand, MatchStatus, ReportStatus, ReportType, Role } from "@/api/types";

export type Tone = "neutral" | "brand" | "info" | "accent" | "success" | "danger";

export const REPORT_TYPE: Record<ReportType, { label: string; tone: Tone }> = {
  LOST: { label: "Lost", tone: "accent" },
  FOUND: { label: "Found", tone: "brand" },
};

export const REPORT_STATUS: Record<ReportStatus, { label: string; tone: Tone; help: string }> = {
  OPEN: { label: "Open", tone: "neutral", help: "Waiting for a possible match." },
  MATCHED: { label: "Matched", tone: "info", help: "A possible match is being verified." },
  CLAIMED: { label: "Claimed", tone: "accent", help: "Ownership claim submitted, awaiting review." },
  HANDED_OVER: { label: "Handed over", tone: "accent", help: "The item is with the owner." },
  RETURNED: { label: "Returned", tone: "success", help: "This item is back with its owner." },
  CLOSED: { label: "Closed", tone: "neutral", help: "The reporter closed this report." },
  EXPIRED: { label: "Expired", tone: "neutral", help: "This report is no longer active." },
};

export const MATCH_BAND: Record<MatchBand, { label: string; tone: Tone; help: string }> = {
  HIGH: { label: "High confidence", tone: "brand", help: "Strong agreement across most signals." },
  MEDIUM: { label: "Possible", tone: "accent", help: "Some signals agree; needs a human check." },
};

export const MATCH_STATUS: Record<MatchStatus, { label: string; tone: Tone }> = {
  SUGGESTED: { label: "Needs review", tone: "info" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  REJECTED: { label: "Rejected", tone: "neutral" },
};

export const CLAIM_STATUS: Record<ClaimStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending review", tone: "accent" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

export const ROLE: Record<Role, { label: string; tone: Tone }> = {
  STUDENT: { label: "Student", tone: "neutral" },
  STAFF: { label: "Staff", tone: "info" },
  ADMIN: { label: "Admin", tone: "brand" },
};

export const SIGNAL_LABELS: Record<string, string> = {
  location: "Location",
  time: "Time",
  text: "Description",
  attributes: "Attributes",
  image: "Photo",
};

export const FINAL_REPORT_STATUSES: ReportStatus[] = ["RETURNED", "CLOSED", "EXPIRED"];

export const DEMO_ACCOUNTS = [
  { label: "Student", email: "student@campus.edu", password: "Student@123" },
  { label: "Staff", email: "staff@campus.edu", password: "Staff@123" },
  { label: "Admin", email: "admin@campus.edu", password: "Admin@123" },
] as const;

export const STATUS_FILTER_OPTIONS: Array<{ value: ReportStatus | ""; label: string }> = [
  { value: "", label: "Any status" },
  { value: "OPEN", label: "Open" },
  { value: "MATCHED", label: "Matched" },
  { value: "CLAIMED", label: "Claimed" },
  { value: "RETURNED", label: "Returned" },
  { value: "CLOSED", label: "Closed" },
];
