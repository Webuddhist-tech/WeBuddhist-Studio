import { z } from "zod";

const localizedNameSchema = z.object({
  language: z.string().min(1, "studio.validation.language_required"),
  name: z
    .string()
    .trim()
    .min(1, "studio.validation.name_required")
    .max(255, "studio.validation.name_max_255"),
});

export const locationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "studio.validation.name_required")
      .max(255, "studio.validation.name_max_255"),
    latitude: z.string().trim(),
    longitude: z.string().trim(),
    /** Per-language names. `name` above stays the canonical one, shown when a
     * reader's language has no entry here. */
    translations: z.array(localizedNameSchema),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.translations.forEach((entry, index) => {
      if (seen.has(entry.language)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "studio.validation.language_name_duplicate",
          path: ["translations", index, "language"],
        });
      }
      seen.add(entry.language);
    });

    const hasLat = data.latitude !== "";
    const hasLng = data.longitude !== "";

    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studio.validation.coordinates_both_or_none",
        path: [hasLat ? "longitude" : "latitude"],
      });
      return;
    }

    if (!hasLat) return;

    const lat = Number(data.latitude);
    const lng = Number(data.longitude);

    if (!Number.isFinite(lat)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studio.validation.latitude_number",
        path: ["latitude"],
      });
    } else if (lat < -90 || lat > 90) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studio.validation.latitude_range",
        path: ["latitude"],
      });
    }

    if (!Number.isFinite(lng)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studio.validation.longitude_number",
        path: ["longitude"],
      });
    } else if (lng < -180 || lng > 180) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studio.validation.longitude_range",
        path: ["longitude"],
      });
    }
  });

export type LocationFormData = z.infer<typeof locationSchema>;

export const defaultLocationFormValues = (): LocationFormData => ({
  name: "",
  latitude: "",
  longitude: "",
  translations: [],
});

export function parseCoordinates(data: LocationFormData): {
  latitude: number | null;
  longitude: number | null;
} {
  if (data.latitude === "" || data.longitude === "") {
    return { latitude: null, longitude: null };
  }
  return { latitude: Number(data.latitude), longitude: Number(data.longitude) };
}

export function coordinateToInput(value: number | undefined | null): string {
  return value == null ? "" : String(value);
}
