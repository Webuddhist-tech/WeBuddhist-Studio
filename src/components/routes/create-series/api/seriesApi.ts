import axiosInstance from "@/config/axios-config";
import { tolgee } from "@/i18n/tolgee";
import {
  LANGUAGE_CODE_ORDER,
  normalizeLanguageCode,
  sortLanguageCodes,
} from "@/lib/languageCodes";
import type {
  LanguageCode,
  SeriesFormData,
  SeriesPlan,
} from "@/schema/SeriesSchema";

export type SeriesMetadataInput = {
  title: string;
  sub_title: string;
  description: string;
  language: LanguageCode;
};

export type SeriesPayload = {
  metadata: SeriesMetadataInput[];
  image_key?: string;
  featured: boolean;
  plans: Partial<Record<LanguageCode, string[]>>;
  group_id?: string;
};

export type SeriesUpdatePayload = Partial<SeriesPayload>;

export type SeriesPlanDTO = {
  id: string;
  title: string;
  description?: string | null;
  language: string;
  group_id?: string | null;
  image_url?: string | null;
  plan_image_url?: string | null;
  image_key?: string | null;
  image?:
    | string
    | {
        medium?: string | null;
        thumbnail?: string | null;
        original?: string | null;
      }
    | null;
  display_order?: number | null;
  total_days?: number | null;
  status?: string;
  featured?: boolean;
  enrolled_count?: number | null;
  subscription_count?: number | null;
  updated_at?: string | null;
  start_date?: string | null;
};

export type SeriesMetadataDTO = {
  id?: string;
  language?: string;
  lang?: string;
  title?: string;
  sub_title?: string;
  description?: string;
};

export type SeriesDetailDTO = {
  id: string;
  name?: Record<string, unknown>;
  metadata?: SeriesMetadataDTO[];
  image?: string | null;
  image_url?: string | null;
  image_key?: string | null;
  author_id?: string;
  group_id?: string | null;
  group?: { id?: string } | null;
  featured: boolean;
  status: string;
  plans: SeriesPlanDTO[];
  total_days?: number;
};

export function resolveSeriesGroupId(
  series:
    | Pick<SeriesDetailDTO, "group_id" | "group" | "plans">
    | null
    | undefined,
): string | undefined {
  if (!series) return undefined;
  if (series.group_id?.trim()) return series.group_id.trim();
  if (series.group?.id?.trim()) return series.group.id.trim();
  const fromPlan = series.plans?.find((p) => p.group_id?.trim())?.group_id;
  return fromPlan?.trim() || undefined;
}

export const getSeries = async (seriesId: string): Promise<SeriesDetailDTO> => {
  const { data } = await axiosInstance.get<SeriesDetailDTO>(
    `/api/v1/cms/series/${seriesId}`,
  );
  return {
    ...data,
    group_id: resolveSeriesGroupId(data) ?? null,
  };
};

export const postSeries = async (body: SeriesPayload) => {
  const { data } = await axiosInstance.post<SeriesDetailDTO>(
    `/api/v1/cms/series`,
    body,
  );
  return data;
};

export const putUpdateSeries = async ({
  seriesId,
  body,
}: {
  seriesId: string;
  body: SeriesPayload | SeriesUpdatePayload;
}) => {
  const { data } = await axiosInstance.put<SeriesDetailDTO>(
    `/api/v1/cms/series/${seriesId}`,
    body,
  );
  return data;
};

export const putSeriesFeatured = async (
  seriesId: string,
  featured: boolean,
) => {
  return putUpdateSeries({ seriesId, body: { featured } });
};

function normalizeLang(raw: string): LanguageCode | null {
  return normalizeLanguageCode(raw);
}

function parseNameObject(
  name: Record<string, unknown>,
): SeriesFormData["languages"] {
  const languages: SeriesFormData["languages"] = {};
  for (const key of Object.keys(name)) {
    const code = normalizeLang(key);
    if (!code) continue;
    const raw = name[key];
    if (raw == null) continue;
    if (typeof raw === "string") {
      languages[code] = { title: raw.trim(), sub_title: "", description: "" };
    } else if (typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      languages[code] = {
        title: String(o.title ?? "").trim(),
        sub_title: String(o.sub_title ?? "").trim(),
        description: String(o.description ?? "").trim(),
      };
    }
  }
  return languages;
}

function parseMetadataArray(
  metadata: SeriesMetadataDTO[],
): SeriesFormData["languages"] {
  const languages: SeriesFormData["languages"] = {};
  for (const row of metadata) {
    const code = normalizeLang(String(row.language ?? row.lang ?? ""));
    if (!code) continue;
    languages[code] = {
      title: String(row.title ?? "").trim(),
      sub_title: String(row.sub_title ?? "").trim(),
      description: String(row.description ?? "").trim(),
    };
  }
  return languages;
}

/** Infer language tabs from attached plans when name/metadata are empty. */
function languagesFromPlans(
  plans: SeriesPlanDTO[],
): SeriesFormData["languages"] {
  const languages: SeriesFormData["languages"] = {};
  const seen = new Set<LanguageCode>();
  for (const p of plans) {
    const code = normalizeLang(p.language);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    languages[code] = { title: "", sub_title: "", description: "" };
  }
  return languages;
}

function resolveSeriesLanguages(
  dto: SeriesDetailDTO,
): SeriesFormData["languages"] {
  if (dto.name && Object.keys(dto.name).length > 0) {
    return parseNameObject(dto.name);
  }
  if (Array.isArray(dto.metadata) && dto.metadata.length > 0) {
    return parseMetadataArray(dto.metadata);
  }
  return languagesFromPlans(dto.plans ?? []);
}

function resolveSeriesImageKey(dto: SeriesDetailDTO): string {
  if (dto.image_key?.trim()) return dto.image_key.trim();
  const image = dto.image;
  if (typeof image === "string" && image && !/^https?:\/\//i.test(image)) {
    return image.trim();
  }
  return "";
}

export function mapSeriesDetailToFormData(
  dto: SeriesDetailDTO,
): SeriesFormData {
  const languages = resolveSeriesLanguages(dto);

  const buckets: Partial<
    Record<LanguageCode, { item: SeriesPlan; ord: number }[]>
  > = {};
  for (const p of dto.plans ?? []) {
    const code = normalizeLang(p.language);
    if (!code) continue;
    const ord =
      typeof p.display_order === "number" && !Number.isNaN(p.display_order)
        ? p.display_order
        : 1_000_000;
    const item: SeriesPlan = {
      id: String(p.id),
      title: p.title,
      image_url: p.image_url ?? undefined,
    };
    if (!buckets[code]) buckets[code] = [];
    buckets[code]!.push({ item, ord });
  }

  const order: LanguageCode[] = [...LANGUAGE_CODE_ORDER];
  const plans: SeriesFormData["plans"] = {};
  for (const code of order) {
    const row = buckets[code];
    if (!row?.length) continue;
    plans[code] = [...row].sort((a, b) => a.ord - b.ord).map((x) => x.item);
  }

  return {
    languages,
    plans,
    image_url: resolveSeriesImageKey(dto),
  };
}

export function buildSeriesMetadata(
  languages: SeriesFormData["languages"],
): SeriesMetadataInput[] {
  const out: SeriesMetadataInput[] = [];
  for (const code of sortLanguageCodes(Object.keys(languages))) {
    const block = languages[code];
    if (!block) continue;
    out.push({
      language: code,
      title: block.title.trim(),
      sub_title: block.sub_title.trim(),
      description: block.description.trim(),
    });
  }
  return out;
}

export function buildSeriesPlansJson(
  data: SeriesFormData,
  languageCodes: LanguageCode[],
): Partial<Record<LanguageCode, string[]>> {
  const plans: Partial<Record<LanguageCode, string[]>> = {};
  for (const code of languageCodes) {
    const list = data.plans[code] ?? [];
    plans[code] = list.map((p) => p.id);
  }
  return plans;
}

export function buildSeriesWriteBody(
  data: SeriesFormData,
  featured: boolean,
  groupId?: string,
): SeriesPayload {
  const metadata = buildSeriesMetadata(data.languages);
  const languageCodes = metadata.map((m) => m.language);
  const imageKey = data.image_url.trim();
  return {
    metadata,
    featured,
    plans: buildSeriesPlansJson(data, languageCodes),
    ...(imageKey ? { image_key: imageKey } : {}),
    ...(groupId ? { group_id: groupId } : {}),
  };
}

export function buildSeriesCreateBody(
  data: SeriesFormData,
  featured = false,
  groupId?: string,
): SeriesPayload {
  return buildSeriesWriteBody(data, featured, groupId);
}

function seriesMetadataEqual(
  a: SeriesMetadataInput[],
  b: SeriesMetadataInput[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].language !== b[i].language) return false;
    if (a[i].title !== b[i].title) return false;
    if (a[i].sub_title !== b[i].sub_title) return false;
    if (a[i].description !== b[i].description) return false;
  }
  return true;
}

function seriesPlansEqual(
  a: Partial<Record<LanguageCode, string[]>>,
  b: Partial<Record<LanguageCode, string[]>>,
): boolean {
  const codes = new Set<LanguageCode>([
    ...(Object.keys(a) as LanguageCode[]),
    ...(Object.keys(b) as LanguageCode[]),
  ]);
  for (const code of codes) {
    const aIds = a[code] ?? [];
    const bIds = b[code] ?? [];
    if (aIds.length !== bIds.length) return false;
    for (let i = 0; i < aIds.length; i++) {
      if (aIds[i] !== bIds[i]) return false;
    }
  }
  return true;
}

export function buildSeriesPartialUpdateBody(
  current: SeriesFormData,
  original: SeriesFormData,
  featured: boolean,
  originalFeatured: boolean,
): SeriesUpdatePayload {
  const body: SeriesUpdatePayload = {};

  const currentMetadata = buildSeriesMetadata(current.languages);
  const originalMetadata = buildSeriesMetadata(original.languages);
  if (!seriesMetadataEqual(currentMetadata, originalMetadata)) {
    body.metadata = currentMetadata;
  }

  const currentImageKey = current.image_url.trim();
  const originalImageKey = original.image_url.trim();
  if (currentImageKey !== originalImageKey && currentImageKey) {
    body.image_key = currentImageKey;
  }

  if (featured !== originalFeatured) {
    body.featured = featured;
  }

  const currentPlans = buildSeriesPlansJson(
    current,
    currentMetadata.map((m) => m.language),
  );
  const originalPlans = buildSeriesPlansJson(
    original,
    originalMetadata.map((m) => m.language),
  );
  if (!seriesPlansEqual(currentPlans, originalPlans)) {
    body.plans = currentPlans;
  }

  return body;
}

export function buildSeriesUpdateBody(
  data: SeriesFormData,
  featured: boolean,
  options?: {
    groupId?: string;
    original?: SeriesFormData;
    originalFeatured?: boolean;
  },
): SeriesPayload | SeriesUpdatePayload {
  if (!options?.original) {
    return buildSeriesWriteBody(data, featured, options?.groupId);
  }
  return buildSeriesPartialUpdateBody(
    data,
    options.original,
    featured,
    options.originalFeatured ?? featured,
  );
}

export function buildSeriesPlansPayloadFromIds(
  plansByLang: Partial<Record<LanguageCode, string[]>>,
): Partial<Record<LanguageCode, string[]>> {
  const order: LanguageCode[] = [...LANGUAGE_CODE_ORDER];
  const out: Partial<Record<LanguageCode, string[]>> = {};
  for (const code of order) {
    const ids = plansByLang[code];
    if (ids?.length) out[code] = ids;
  }
  return out;
}

export async function putSeriesPlans(
  seriesId: string,
  plansByLang: Partial<Record<LanguageCode, string[]>>,
) {
  return putUpdateSeries({
    seriesId,
    body: { plans: buildSeriesPlansPayloadFromIds(plansByLang) },
  });
}

export type CloneSeriesPlansPayload = {
  source_language: LanguageCode;
  target_language: LanguageCode;
};

export async function cloneSeriesPlansFromLanguage(
  seriesId: string,
  payload: CloneSeriesPlansPayload,
) {
  const { data } = await axiosInstance.post<SeriesDetailDTO>(
    `/api/v1/cms/series/${seriesId}/clone-plans`,
    payload,
  );
  return data;
}

export type SeriesListItemDTO = {
  id: string;
  metadata?: SeriesMetadataDTO[];
  image?: string | null;
  image_key?: string | null;
  author_id?: string;
  featured?: boolean;
  status?: string;
  plan_count?: number;
  total_days?: number;
};

export type SeriesListResponse = {
  series: SeriesListItemDTO[];
};

export type SeriesOption = {
  id: string;
  title: string;
};

function resolveSeriesListTitle(metadata?: SeriesMetadataDTO[]): string {
  if (!Array.isArray(metadata) || metadata.length === 0)
    return tolgee.t("studio.series.untitled");
  const order = [...LANGUAGE_CODE_ORDER];
  for (const lang of order) {
    const row = metadata.find(
      (r) => String(r.language ?? r.lang ?? "").toUpperCase() === lang,
    );
    const t = row?.title?.trim();
    if (t) return t;
  }
  for (const row of metadata) {
    const t = row.title?.trim();
    if (t) return t;
  }
  return tolgee.t("studio.series.untitled");
}

export const fetchSeriesList = async (): Promise<SeriesOption[]> => {
  const { data } = await axiosInstance.get<SeriesListResponse>(
    `/api/v1/cms/series`,
    { params: { limit: 100 } },
  );
  return (data?.series ?? []).map((s) => ({
    id: s.id,
    title: resolveSeriesListTitle(s.metadata),
  }));
};
