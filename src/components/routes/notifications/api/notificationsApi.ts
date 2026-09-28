import axiosInstance from "@/config/axios-config";

import { getAuthHeaders } from "@/lib/auth-storage";
export type NotificationCategory =
  | "group_invite"
  | "content_transfer_incoming"
  | "group_join_request"
  | (string & {});

export interface NotificationDTO {
  id: string;
  title: string;
  description?: string | null;
  category: NotificationCategory;
  reference_id?: string | null;
  /** Target group for content_transfer_incoming (when provided by API). */
  target_group_id?: string | null;
  group_id?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

function normalizeNotification(raw: unknown): NotificationDTO | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Record<string, unknown>;
  const id = typeof n.id === "string" ? n.id : undefined;
  if (!id) return null;
  const metadata =
    n.metadata && typeof n.metadata === "object"
      ? (n.metadata as Record<string, unknown>)
      : null;
  const targetFromMeta =
    typeof metadata?.target_group_id === "string"
      ? metadata.target_group_id
      : typeof metadata?.group_id === "string"
        ? metadata.group_id
        : undefined;

  return {
    id,
    title: typeof n.title === "string" ? n.title : "Notification",
    description: typeof n.description === "string" ? n.description : null,
    category: (typeof n.category === "string"
      ? n.category
      : "group_invite") as NotificationCategory,
    reference_id: typeof n.reference_id === "string" ? n.reference_id : null,
    target_group_id:
      (typeof n.target_group_id === "string" ? n.target_group_id : null) ??
      (typeof n.group_id === "string" ? n.group_id : null) ??
      targetFromMeta ??
      null,
    group_id: typeof n.group_id === "string" ? n.group_id : null,
    is_read: Boolean(n.is_read),
    read_at: typeof n.read_at === "string" ? n.read_at : null,
    created_at:
      typeof n.created_at === "string"
        ? n.created_at
        : new Date().toISOString(),
  };
}

function normalizeNotificationList(data: unknown): NotificationListResponse {
  if (!data || typeof data !== "object") {
    return { notifications: [], skip: 0, limit: 0, total: 0 };
  }
  const root = data as Record<string, unknown>;
  const list = Array.isArray(root.notifications)
    ? root.notifications
    : Array.isArray(root.items)
      ? root.items
      : [];
  const notifications = list
    .map(normalizeNotification)
    .filter((n): n is NotificationDTO => n != null);
  return {
    notifications,
    skip: typeof root.skip === "number" ? root.skip : 0,
    limit: typeof root.limit === "number" ? root.limit : notifications.length,
    total: typeof root.total === "number" ? root.total : notifications.length,
  };
}

export interface NotificationListResponse {
  notifications: NotificationDTO[];
  skip: number;
  limit: number;
  total: number;
}

export interface FetchNotificationsParams {
  unread_only?: boolean;
  skip?: number;
  limit?: number;
}

export const fetchNotifications = async (
  params: FetchNotificationsParams = {},
): Promise<NotificationListResponse> => {
  const { data } = await axiosInstance.get(`/api/v1/cms/notifications`, {
    headers: getAuthHeaders(),
    params: {
      unread_only: params.unread_only ?? false,
      skip: params.skip ?? 0,
      limit: params.limit ?? 20,
    },
  });
  return normalizeNotificationList(data);
};

export const markNotificationRead = async (
  notificationId: string,
): Promise<NotificationDTO> => {
  const { data } = await axiosInstance.patch<NotificationDTO>(
    `/api/v1/cms/notifications/${notificationId}/read`,
    {},
    { headers: getAuthHeaders() },
  );
  return data;
};

export const isGroupInviteNotification = (
  notification: NotificationDTO,
): boolean =>
  notification.category === "group_invite" &&
  Boolean(notification.reference_id);

export const isContentTransferNotification = (
  notification: NotificationDTO,
): boolean =>
  notification.category === "content_transfer_incoming" &&
  Boolean(notification.reference_id);

/**
 * Note: unlike `group_invite` and `content_transfer_incoming` — whose
 * `reference_id` is the entity their bell actions operate on — a
 * `group_join_request` notification carries the GROUP id in `reference_id`,
 * not the join-request id. The bell takes no per-request action for this
 * category; the id exists purely to route to the review screen, which lists
 * every pending request for the group.
 */
export const isGroupJoinRequestNotification = (
  notification: NotificationDTO,
): boolean =>
  notification.category === "group_join_request" &&
  Boolean(notification.reference_id);

export function getJoinRequestNotificationGroupId(
  notification: NotificationDTO,
): string | undefined {
  return notification.reference_id?.trim() || undefined;
}

export function getTransferNotificationTargetGroupId(
  notification: NotificationDTO,
): string | undefined {
  return (
    notification.target_group_id?.trim() ||
    notification.group_id?.trim() ||
    undefined
  );
}
