import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(value);
  return isValid(date) ? date : null;
}

/** "27 Oct 2026, 7:25 PM" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "d MMM yyyy, h:mm a") : "-";
}

/** "27 Oct 2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "d MMM yyyy") : "-";
}

/** "3 hours ago" */
export function formatRelative(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "-";
  return `${formatDistanceToNowStrict(date)} ago`;
}

/** Local value for <input type="datetime-local">. */
export function toDateTimeLocal(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "yyyy-MM-dd'T'HH:mm") : "";
}

/** Convert a datetime-local value (local time) into a UTC ISO string. */
export function fromDateTimeLocal(value: string): string {
  const date = new Date(value);
  return isValid(date) ? date.toISOString() : "";
}

export function nowDateTimeLocal(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
