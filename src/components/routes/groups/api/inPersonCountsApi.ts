import axiosInstance from "@/config/axios-config";
import { getApiErrorMessage } from "@/lib/apiErrors";
import type { GroupAccumulatorImage } from "./groupAccumulatorsApi";

/**
 * Counts made at an event in person, by people not using the app. The backend
 * keeps them as the in-person account's rows in the event's group
 * accumulation, one per day in the event's timezone.
 */
export interface InPersonCount {
  id: string;
  /** YYYY-MM-DD in the event's timezone. */
  day: string;
  count: number;
  created_at: string;
  updated_at: string | null;
}

export interface InPersonCountList {
  items: InPersonCount[];
  total: number;
  skip: number;
  limit: number;
  /** Sum of every in-person count in the group accumulation. */
  total_count: number;
  /** Null when the event has no group accumulation linked. */
  group_accumulator_id: string | null;
  /** The linked group accumulation the counts are added to. */
  group_accumulator_title?: string | null;
  /** Everyone's total in it, in-person counts included. */
  group_accumulator_total_count?: number | null;
  group_accumulator_target_count?: number | null;
  group_accumulator_image?: GroupAccumulatorImage | null;
  timezone: string;
}

export interface InPersonCountPayload {
  day: string;
  count: number;
}

export const IN_PERSON_COUNT_EXISTS = "IN_PERSON_COUNT_EXISTS";
export const EVENT_HAS_NO_GROUP_ACCUMULATOR = "EVENT_HAS_NO_GROUP_ACCUMULATOR";
export const IN_PERSON_USER_NOT_FOUND = "IN_PERSON_USER_NOT_FOUND";

const basePath = (eventId: string) =>
  `/api/v1/cms/events/${eventId}/in-person-counts`;

export const inPersonCountsQueryKey = (eventId: string) => [
  "cms-event-in-person-counts",
  eventId,
];

export const fetchInPersonCounts = async (
  eventId: string,
  { skip, limit }: { skip: number; limit: number },
): Promise<InPersonCountList> => {
  const { data } = await axiosInstance.get<InPersonCountList>(
    basePath(eventId),
    { params: { skip, limit } },
  );
  return data;
};

export const createInPersonCount = async (
  eventId: string,
  payload: InPersonCountPayload,
): Promise<InPersonCount> => {
  const { data } = await axiosInstance.post<InPersonCount>(
    basePath(eventId),
    payload,
  );
  return data;
};

export const updateInPersonCount = async (
  eventId: string,
  countId: string,
  payload: InPersonCountPayload,
): Promise<InPersonCount> => {
  const { data } = await axiosInstance.put<InPersonCount>(
    `${basePath(eventId)}/${countId}`,
    payload,
  );
  return data;
};

export const deleteInPersonCount = async (
  eventId: string,
  countId: string,
): Promise<void> => {
  await axiosInstance.delete(`${basePath(eventId)}/${countId}`);
};

export const getInPersonCountErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  if (detail === IN_PERSON_COUNT_EXISTS) {
    return "That day already has an in-person count. Edit it instead.";
  }
  if (detail === EVENT_HAS_NO_GROUP_ACCUMULATOR) {
    return "Link a group accumulation to this event first.";
  }
  if (detail === IN_PERSON_USER_NOT_FOUND) {
    return "The in-person account is missing on the server.";
  }
  return getApiErrorMessage(error, fallback);
};
