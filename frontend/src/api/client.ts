import { ApiError } from "./errors";
import { clearToken, getToken } from "@/lib/storage";

const rawBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";
const rawMedia = import.meta.env.VITE_MEDIA_BASE_URL ?? "http://127.0.0.1:8000";

export const API_BASE = rawBase.replace(/\/+$/, "");
export const MEDIA_BASE = rawMedia.replace(/\/+$/, "");

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Registered by AuthProvider so a stale token logs the user out everywhere. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  /** Set false for public endpoints such as login. */
  auth?: boolean;
}

interface ErrorPayload {
  detail?:
    | string
    | { code?: string; message?: string; fields?: Record<string, string> | null }
    | Array<{ loc?: Array<string | number>; msg?: string }>;
}

function parseError(status: number, payload: unknown): ApiError {
  const body = payload as ErrorPayload | null;
  const detail = body?.detail;

  if (typeof detail === "string") {
    return new ApiError(status, "error", detail);
  }

  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {};
    for (const item of detail) {
      const key = item.loc?.filter((part) => part !== "body").join(".") ?? "form";
      fields[key] = item.msg ?? "Invalid value";
    }
    const first = detail[0]?.msg ?? "Please check the highlighted fields.";
    return new ApiError(status, "validation_error", first, fields);
  }

  if (detail && typeof detail === "object") {
    return new ApiError(
      status,
      detail.code ?? "error",
      detail.message ?? "The request could not be completed.",
      detail.fields ?? undefined,
    );
  }

  if (status === 401) return new ApiError(status, "unauthorized", "Your session has expired. Please sign in again.");
  if (status === 403) return new ApiError(status, "forbidden", "You do not have permission to do that.");
  if (status === 404) return new ApiError(status, "not_found", "We could not find what you were looking for.");
  if (status === 409) return new ApiError(status, "conflict", "That action conflicts with the current state.");
  if (status >= 500) return new ApiError(status, "server_error", "The server hit a problem. Please try again.");
  return new ApiError(status, "error", "The request could not be completed.");
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, signal, auth = true } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "network_error",
      `Cannot reach the CampusFind API at ${API_BASE}. Is the backend running?`,
    );
  }

  if (response.status === 401 && auth) {
    clearToken();
    unauthorizedHandler?.();
  }

  if (!response.ok) {
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    throw parseError(response.status, parsed);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

type QueryValue = string | number | boolean | null | undefined;

export function qs(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** photo_url is already a server path such as /media/reports/abc.jpg */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${MEDIA_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}
