import type { ClaimStatus, MatchBand, MatchStatus, ReportStatus, ReportType, Role } from "@/api/types";
import { Badge } from "@/components/ui/Badge";
import { CLAIM_STATUS, MATCH_BAND, MATCH_STATUS, REPORT_STATUS, REPORT_TYPE, ROLE } from "@/lib/constants";

type Size = "sm" | "md";

export function TypeBadge({ type, size }: { type: ReportType; size?: Size }) {
  const meta = REPORT_TYPE[type];
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  );
}

export function ReportStatusBadge({ status, size }: { status: ReportStatus; size?: Size }) {
  const meta = REPORT_STATUS[status];
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  );
}

export function BandBadge({ band, size }: { band: MatchBand; size?: Size }) {
  const meta = MATCH_BAND[band];
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  );
}

export function MatchStatusBadge({ status, size }: { status: MatchStatus; size?: Size }) {
  const meta = MATCH_STATUS[status];
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  );
}

export function ClaimStatusBadge({ status, size }: { status: ClaimStatus; size?: Size }) {
  const meta = CLAIM_STATUS[status];
  return (
    <Badge tone={meta.tone} size={size} dot>
      {meta.label}
    </Badge>
  );
}

export function RoleBadge({ role, size }: { role: Role; size?: Size }) {
  const meta = ROLE[role];
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  );
}
