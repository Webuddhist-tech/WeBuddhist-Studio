import {
  fetchGroupAccumulators,
  resolveGroupAccumulatorImageUrl,
} from "@/components/routes/groups/api/groupAccumulatorsApi";
import { fetchChantCollections } from "@/components/routes/groups/api/chantsApi";
import {
  eventName,
  fetchCmsEvents,
} from "@/components/routes/groups/api/eventsApi";
import { fetchGroupPosts } from "@/components/routes/groups/api/groupPostsApi";
import { tolgee } from "@/i18n/tolgee";
import { ROUTES } from "@/routes/paths";

/**
 * Subtask content types that link to another piece of WeBuddhist content
 * instead of carrying the content inline. Each stores the target's id in
 * `reference_id`; the backend resolves it into `reference` on read.
 */
export const LINKED_CONTENT_TYPES = [
  "GROUP_ACCUMULATION",
  "GROUP_COLLECTION",
  "EVENT",
  "POST",
] as const;

export type LinkedContentType = (typeof LINKED_CONTENT_TYPES)[number];

export const LINKED_CONTENT_LABELS: Record<LinkedContentType, string> = {
  GROUP_ACCUMULATION: "Accumulation",
  GROUP_COLLECTION: "Chant collection",
  EVENT: "Event",
  POST: "Post",
};

/** Translation keys for every per-type phrase, kept as literals so key
 * extraction finds them. Each type gets whole sentences rather than a label
 * spliced into English, since word order differs between languages. */
export interface LinkedContentI18nKeys {
  label: string;
  unavailable: string;
  notLinked: string;
  loadFailed: string;
  noneFound: string;
  groupEmpty: string;
  sheetTitle: string;
  searchPlaceholder: string;
  untitled: string;
}

export const LINKED_CONTENT_I18N: Record<
  LinkedContentType,
  LinkedContentI18nKeys
> = {
  GROUP_ACCUMULATION: {
    label: "studio.content.linked.accumulation.label",
    unavailable: "studio.content.linked.accumulation.unavailable",
    notLinked: "studio.content.linked.accumulation.not_linked",
    loadFailed: "studio.content.linked.accumulation.load_failed",
    noneFound: "studio.content.linked.accumulation.none_found",
    groupEmpty: "studio.content.linked.accumulation.group_empty",
    sheetTitle: "studio.content.linked.accumulation.sheet_title",
    searchPlaceholder: "studio.content.linked.accumulation.search_placeholder",
    untitled: "studio.content.linked.accumulation.untitled",
  },
  GROUP_COLLECTION: {
    label: "studio.content.linked.chant_collection.label",
    unavailable: "studio.content.linked.chant_collection.unavailable",
    notLinked: "studio.content.linked.chant_collection.not_linked",
    loadFailed: "studio.content.linked.chant_collection.load_failed",
    noneFound: "studio.content.linked.chant_collection.none_found",
    groupEmpty: "studio.content.linked.chant_collection.group_empty",
    sheetTitle: "studio.content.linked.chant_collection.sheet_title",
    searchPlaceholder:
      "studio.content.linked.chant_collection.search_placeholder",
    untitled: "studio.content.linked.chant_collection.untitled",
  },
  EVENT: {
    label: "studio.content.linked.event.label",
    unavailable: "studio.content.linked.event.unavailable",
    notLinked: "studio.content.linked.event.not_linked",
    loadFailed: "studio.content.linked.event.load_failed",
    noneFound: "studio.content.linked.event.none_found",
    groupEmpty: "studio.content.linked.event.group_empty",
    sheetTitle: "studio.content.linked.event.sheet_title",
    searchPlaceholder: "studio.content.linked.event.search_placeholder",
    untitled: "studio.content.linked.event.untitled",
  },
  POST: {
    label: "studio.content.linked.post.label",
    unavailable: "studio.content.linked.post.unavailable",
    notLinked: "studio.content.linked.post.not_linked",
    loadFailed: "studio.content.linked.post.load_failed",
    noneFound: "studio.content.linked.post.none_found",
    groupEmpty: "studio.content.linked.post.group_empty",
    sheetTitle: "studio.content.linked.post.sheet_title",
    searchPlaceholder: "studio.content.linked.post.search_placeholder",
    untitled: "studio.content.linked.post.untitled",
  },
};

/** Every entity the backend resolves for a subtask reference. */
export interface SubTaskReference {
  id: string;
  content_type: LinkedContentType;
  title?: string | null;
  subtitle?: string | null;
  image_url?: string | null;
  group_id?: string | null;
}

/** One row in the picker sheet. */
export interface LinkedContentOption {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
}

export interface LinkedContentPage {
  items: LinkedContentOption[];
  total: number;
}

export const isLinkedContentType = (
  value: string,
): value is LinkedContentType =>
  (LINKED_CONTENT_TYPES as readonly string[]).includes(value);

/**
 * Only accumulations can be searched server-side; for the other types the
 * sheet filters the page it has already loaded.
 */
export const supportsServerSearch = (type: LinkedContentType): boolean =>
  type === "GROUP_ACCUMULATION";

const untitled = (type: LinkedContentType) =>
  tolgee.t(LINKED_CONTENT_I18N[type].untitled);

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start) return null;
  const format = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const from = format(start);
  const to = end ? format(end) : null;
  return to && to !== from ? `${from} – ${to}` : from;
};

const firstLine = (value?: string | null, limit = 90) => {
  if (!value) return null;
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed.length > limit
    ? `${collapsed.slice(0, limit - 3)}...`
    : collapsed;
};

interface FetchArgs {
  groupId: string;
  skip: number;
  limit: number;
  search?: string;
}

const FETCHERS: Record<
  LinkedContentType,
  (args: FetchArgs) => Promise<LinkedContentPage>
> = {
  GROUP_ACCUMULATION: async ({ groupId, skip, limit, search }) => {
    const data = await fetchGroupAccumulators(groupId, { skip, limit, search });
    return {
      total: data.total,
      items: data.accumulators.map((accumulator) => ({
        id: accumulator.id,
        title: accumulator.title || untitled("GROUP_ACCUMULATION"),
        subtitle: accumulator.target_count
          ? tolgee.t("studio.content.linked.accumulation.target", {
              count: accumulator.target_count.toLocaleString(),
            })
          : null,
        imageUrl: resolveGroupAccumulatorImageUrl(accumulator),
      })),
    };
  },

  GROUP_COLLECTION: async ({ groupId, skip, limit }) => {
    const data = await fetchChantCollections(groupId, skip, limit);
    return {
      total: data.total,
      items: data.collections.map((collection) => ({
        id: collection.id,
        title: collection.name || untitled("GROUP_COLLECTION"),
        subtitle:
          collection.item_count != null
            ? collection.item_count === 1
              ? tolgee.t("studio.content.linked.chant_collection.chants_one")
              : tolgee.t(
                  "studio.content.linked.chant_collection.chants_other",
                  { count: collection.item_count },
                )
            : null,
        imageUrl: collection.img_url ?? null,
      })),
    };
  },

  EVENT: async ({ groupId, skip, limit }) => {
    const data = await fetchCmsEvents({ group_id: groupId, skip, limit });
    return {
      total: data.total,
      items: data.events.map((event) => ({
        id: event.id,
        title: eventName(event) || untitled("EVENT"),
        subtitle: formatDateRange(event.start_date, event.end_date),
        imageUrl:
          event.image?.medium ||
          event.image?.thumbnail ||
          event.image?.original ||
          null,
      })),
    };
  },

  POST: async ({ groupId, skip, limit }) => {
    // Only published posts are referenceable; the backend rejects hidden ones,
    // so listing them here would just offer a choice that cannot be saved.
    const data = await fetchGroupPosts(groupId, skip, limit, "PUBLISHED");
    return {
      total: data.total,
      items: data.posts.map((post) => ({
        id: post.id,
        // Posts have no title; the caption stands in for one.
        title: firstLine(post.caption) || untitled("POST"),
        subtitle: formatDateRange(post.published_at),
        imageUrl:
          post.media?.[0]?.thumbnail_url || post.media?.[0]?.url || null,
      })),
    };
  },
};

export const fetchLinkedContent = (
  type: LinkedContentType,
  args: FetchArgs,
): Promise<LinkedContentPage> => FETCHERS[type](args);

/**
 * Where each type is created in Studio. Accumulations have no page of their
 * own: they are created from the group's content page.
 */
export const LINKED_CONTENT_CREATE_PATHS: Record<
  LinkedContentType,
  (groupId: string) => string
> = {
  GROUP_ACCUMULATION: ROUTES.groupContent,
  GROUP_COLLECTION: ROUTES.groupChantNew,
  EVENT: ROUTES.groupEventNew,
  POST: ROUTES.groupPostNew,
};

/** Types simple enough to create without leaving the picker. */
export const supportsQuickCreate = (type: LinkedContentType): boolean =>
  type === "GROUP_COLLECTION";
