import { apiRequest, qs } from "./client";
import type {
  AuditEntry,
  Category,
  CategoryDetail,
  CategoryField,
  ClaimDetail,
  ClaimStatus,
  ClaimSummary,
  Location,
  LocationNode,
  Match,
  MatchBand,
  MatchStatus,
  MatchWithBreakdown,
  Meta,
  NotificationItem,
  Page,
  Report,
  ReportCreateInput,
  ReportStatus,
  ReportSummary,
  ReportType,
  Role,
  StatsToday,
  TokenResponse,
  User,
  VerificationQueueItem,
} from "./types";

export interface ReportListParams {
  type?: ReportType;
  category?: string;
  location_id?: number;
  status?: ReportStatus;
  q?: string;
  mine?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface PageParams {
  page?: number;
  page_size?: number;
}

export const endpoints = {
  /* ------------------------------ auth ------------------------------ */
  login: (email: string, password: string) =>
    apiRequest<TokenResponse>("/auth/login/json", {
      method: "POST",
      body: { email, password },
      auth: false,
    }),

  register: (body: {
    email: string;
    password: string;
    full_name: string;
    roll_number?: string;
    department?: string;
    phone?: string;
  }) =>
    apiRequest<User>("/auth/register", {
      method: "POST",
      body,
      auth: false,
    }),

  me: () => apiRequest<User>("/auth/me"),

  updateMe: (body: {
    full_name?: string;
    department?: string | null;
    phone?: string | null;
    roll_number?: string | null;
  }) => apiRequest<User>("/auth/me", { method: "PATCH", body }),

  changePassword: (body: { current_password: string; new_password: string }) =>
    apiRequest<{ message: string }>("/auth/change-password", { method: "POST", body }),

  /* ----------------------------- catalog ---------------------------- */
  meta: () => apiRequest<Meta>("/meta", { auth: false }),

  categories: () => apiRequest<Category[]>("/categories", { auth: false }),

  category: (key: string) => apiRequest<CategoryDetail>(`/categories/${key}`, { auth: false }),

  categoryFields: (key: string) =>
    apiRequest<CategoryField[]>(`/categories/${key}/fields`, { auth: false }),

  locations: (params: { parent_id?: number; q?: string } = {}) =>
    apiRequest<Location[]>(`/locations${qs(params)}`, { auth: false }),

  locationTree: () => apiRequest<LocationNode[]>("/locations/tree", { auth: false }),

  /* ----------------------------- reports ---------------------------- */
  reports: (params: ReportListParams = {}) =>
    apiRequest<Page<ReportSummary>>(`/reports${qs({ ...params })}`),

  report: (id: number) => apiRequest<Report>(`/reports/${id}`),

  createReport: (body: ReportCreateInput) =>
    apiRequest<Report>("/reports", { method: "POST", body }),

  updateReport: (id: number, body: Partial<ReportCreateInput>) =>
    apiRequest<Report>(`/reports/${id}`, { method: "PATCH", body }),

  uploadPhoto: (id: number, file: File) => {
    const form = new FormData();
    form.append("photo", file);
    return apiRequest<Report>(`/reports/${id}/photo`, { method: "POST", formData: form });
  },

  closeReport: (id: number, reason?: string) =>
    apiRequest<{ message: string }>(`/reports/${id}/close`, {
      method: "POST",
      body: reason ? { reason } : {},
    }),

  reportMatches: (id: number, minScore = 0) =>
    apiRequest<Match[]>(`/reports/${id}/matches${qs({ min_score: minScore })}`),

  /* ------------------------------ claims ---------------------------- */
  createClaim: (body: { match_id: number; answers: Record<string, unknown> }) =>
    apiRequest<ClaimDetail>("/claims", { method: "POST", body }),

  myClaims: (params: PageParams = {}) =>
    apiRequest<Page<ClaimSummary>>(`/claims/mine${qs({ ...params })}`),

  /* --------------------------- notifications ------------------------ */
  notifications: (params: PageParams & { unread_only?: boolean } = {}) =>
    apiRequest<Page<NotificationItem>>(`/notifications${qs({ ...params })}`),

  unreadCount: () => apiRequest<{ unread: number }>("/notifications/unread-count"),

  markNotificationRead: (id: number) =>
    apiRequest<{ message: string }>(`/notifications/${id}/read`, { method: "POST" }),

  markAllNotificationsRead: () =>
    apiRequest<{ message: string }>("/notifications/read-all", { method: "POST" }),

  /* ------------------------------ admin ----------------------------- */
  statsToday: () => apiRequest<StatsToday>("/admin/stats/today"),

  verificationQueue: (limit = 20) =>
    apiRequest<VerificationQueueItem[]>(`/admin/verification-queue${qs({ limit })}`),

  adminMatches: (
    params: PageParams & { status?: MatchStatus; band?: MatchBand; min_score?: number } = {},
  ) => apiRequest<Page<MatchWithBreakdown>>(`/admin/matches${qs({ ...params })}`),

  adminMatch: (id: number) => apiRequest<MatchWithBreakdown>(`/admin/matches/${id}`),

  confirmMatch: (id: number, note?: string) =>
    apiRequest<MatchWithBreakdown>(`/admin/matches/${id}/confirm`, {
      method: "POST",
      body: { note: note || null },
    }),

  rejectMatch: (id: number, note?: string) =>
    apiRequest<MatchWithBreakdown>(`/admin/matches/${id}/reject`, {
      method: "POST",
      body: { note: note || null },
    }),

  adminClaims: (params: PageParams & { status?: ClaimStatus } = {}) =>
    apiRequest<Page<ClaimDetail>>(`/admin/claims${qs({ ...params })}`),

  approveClaim: (id: number, notes?: string) =>
    apiRequest<ClaimDetail>(`/admin/claims/${id}/approve`, {
      method: "POST",
      body: { notes: notes || null },
    }),

  rejectClaim: (id: number, notes?: string) =>
    apiRequest<ClaimDetail>(`/admin/claims/${id}/reject`, {
      method: "POST",
      body: { notes: notes || null },
    }),

  users: (params: PageParams & { q?: string } = {}) =>
    apiRequest<Page<User>>(`/admin/users${qs({ ...params })}`),

  updateUserRole: (id: number, role: Role) =>
    apiRequest<User>(`/admin/users/${id}/role`, { method: "PATCH", body: { role } }),

  auditLog: (params: PageParams & { action?: string } = {}) =>
    apiRequest<Page<AuditEntry>>(`/admin/audit-log${qs({ ...params })}`),
};
