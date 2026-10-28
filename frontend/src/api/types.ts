import type { components } from "./schema";

type S = components["schemas"];

export type Role = S["Role"];
export type ReportType = S["ReportType"];
export type ReportStatus = S["ReportStatus"];
export type MatchBand = S["MatchBand"];
export type MatchStatus = S["MatchStatus"];
export type ClaimStatus = S["ClaimStatus"];
export type FieldType = S["FieldType"];
export type LocationType = S["LocationType"];

export type User = S["UserOut"];
export type UserBrief = S["UserBrief"];
export type TokenResponse = S["Token"];

export type Category = S["CategoryOut"];
export type CategoryDetail = S["CategoryDetail"];
export type CategoryField = S["CategoryFieldOut"];
export type Location = S["LocationOut"];
export type LocationNode = S["LocationNode"];

export type ReportSummary = S["ReportPublic"];
export type Report = S["ReportDetail"];
export type Match = S["MatchOut"];
export type MatchWithBreakdown = S["MatchDetail"];

export type ClaimDetail = S["ClaimDetail"];
export type StatsToday = S["StatsToday"];
export type VerificationQueueItem = S["VerificationQueueItem"];

/** Envelope used by every paginated endpoint. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/** `GET /claims/mine` returns ClaimOut (ClaimDetail minus answers). */
export interface ClaimSummary {
  id: number;
  match_id: number;
  claimant: UserBrief;
  status: ClaimStatus;
  notes: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  actor_id: number | null;
  action: string;
  entity: string | null;
  entity_id: number | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export type SignalName = "location" | "time" | "text" | "attributes" | "image";

export interface ScoreBreakdown {
  signals?: Partial<Record<SignalName, number | null>>;
  effective_weights?: Record<string, number>;
  weights_used?: Record<string, number>;
  signals_used?: string[];
  signals_missing?: string[];
  base_score?: number;
  hidden_detail_similarity?: number;
  hidden_detail_bonus?: number;
  final_score?: number;
  band?: MatchBand;
  reason?: string;
}

export interface Meta {
  app: string;
  version: string;
  environment: string;
  api_prefix: string;
  docs_url: string;
  openapi_url: string;
  matching: {
    default_weights: Record<string, number>;
    category_weight_overrides: Record<string, Record<string, number>>;
    thresholds: {
      high_band: number;
      medium_band: number;
      max_gap_days: number;
      found_before_lost_grace_hours: number;
      hidden_detail_bonus: number;
    };
  };
  uploads: {
    max_upload_mb: number;
    allowed_types: string[];
    media_prefix: string;
  };
  enums: Record<string, string[]>;
}

export interface ReportCreateInput {
  type: ReportType;
  category_key: string;
  title: string;
  public_description?: string | null;
  hidden_detail?: string | null;
  attributes?: Record<string, unknown>;
  location_id?: number | null;
  occurred_at: string;
  deposited_location_id?: number | null;
}
