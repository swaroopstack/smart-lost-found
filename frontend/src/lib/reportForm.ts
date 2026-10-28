import { z } from "zod";

export const reportFormSchema = z.object({
  type: z.enum(["LOST", "FOUND"]),
  category_key: z.string().min(1, "Choose a category"),
  title: z
    .string()
    .trim()
    .min(3, "Give the item a short title, at least 3 characters")
    .max(140, "Keep the title under 140 characters"),
  public_description: z
    .string()
    .max(2000, "Keep the public description under 2000 characters")
    .optional(),
  hidden_detail: z
    .string()
    .max(500, "Keep the private detail under 500 characters")
    .optional(),
  attributes: z.record(z.unknown()),
  location_id: z.number().int().nullable(),
  deposited_location_id: z.number().int().nullable(),
  occurred_at: z.string().min(1, "Choose when this happened"),
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;

export const emptyReportForm: ReportFormValues = {
  type: "LOST",
  category_key: "",
  title: "",
  public_description: "",
  hidden_detail: "",
  attributes: {},
  location_id: null,
  deposited_location_id: null,
  occurred_at: "",
};

export interface DraftShape {
  values: ReportFormValues;
  step: number;
  savedAt: string;
}

/** Remove empty strings / NaN / undefined so the API receives a clean object. */
export function cleanAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "number" && Number.isNaN(value)) continue;
    cleaned[key] = value;
  }
  return cleaned;
}
