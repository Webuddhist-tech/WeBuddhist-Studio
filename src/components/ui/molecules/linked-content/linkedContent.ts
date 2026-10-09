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

const UNTITLED: Record<LinkedContentType, string> = {
  GROUP_ACCUMULATION: "Untitled accumulation",
  GROUP_COLLECTION: "Untitled collection",
  EVENT: "Untitled event",
  POST: "Untitled post",
};

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
        title: accumulator.title || UNTITLED.GROUP_ACCUMULATION,
        subtitle: accumulator.target_count
          ? `Target ${accumulator.target_count.toLocaleString()}`
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
        title: collection.name || UNTITLED.GROUP_COLLECTION,
        subtitle:
          collection.item_count != null
            ? `${collection.item_count} chant${collection.item_count === 1 ? "" : "s"}`
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
        title: eventName(event) || UNTITLED.EVENT,
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
        title: firstLine(post.caption) || UNTITLED.POST,
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
