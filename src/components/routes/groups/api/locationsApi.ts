import axiosInstance from "@/config/axios-config";

export interface EventLocation {
  id: string;
  group_id: string;
  /** On public/event reads this is already the name for the requested
   * language, with English as the fallback. */
  name: string;
  latitude?: number;
  longitude?: number;
}

/** One language's name for a location. `name` on the location itself stays the
 * canonical name and the fallback. */
export interface LocationTranslation {
  id?: string;
  name: string;
  language: string;
}

export interface LocationDetail extends EventLocation {
  event_count: number;
  translations?: LocationTranslation[];
}

export interface LocationsResponse {
  locations: LocationDetail[];
  skip: number;
  limit: number;
  total: number;
}

export interface CreateLocationRequest {
  name: string;
  latitude?: number;
  longitude?: number;
  translations?: LocationTranslation[];
}

export interface UpdateLocationRequest {
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Omitted leaves the stored names alone; a list replaces them wholesale. */
  translations?: LocationTranslation[];
}

export interface LocationListParams {
  search?: string;
  skip?: number;
  limit?: number;
}

const BASE_URL = "/api/v1/cms/author/groups";

export const MAX_LOCATION_LIMIT = 100;

const locationsUrl = (groupId: string) => `${BASE_URL}/${groupId}/locations`;

export const fetchLocations = async (
  groupId: string,
  params: LocationListParams = {},
): Promise<LocationsResponse> => {
  const { data } = await axiosInstance.get<LocationsResponse>(
    locationsUrl(groupId),
    {
      params: {
        ...(params.search ? { search: params.search } : {}),
        skip: params.skip ?? 0,
        limit: Math.min(params.limit ?? 20, MAX_LOCATION_LIMIT),
      },
    },
  );
  return data;
};

export const fetchLocation = async (
  groupId: string,
  locationId: string,
): Promise<LocationDetail> => {
  const { data } = await axiosInstance.get<LocationDetail>(
    `${locationsUrl(groupId)}/${locationId}`,
  );
  return data;
};

export const createLocation = async (
  groupId: string,
  body: CreateLocationRequest,
): Promise<LocationDetail> => {
  const { data } = await axiosInstance.post<LocationDetail>(
    locationsUrl(groupId),
    body,
  );
  return data;
};

export const updateLocation = async (
  groupId: string,
  locationId: string,
  body: UpdateLocationRequest,
): Promise<LocationDetail> => {
  const { data } = await axiosInstance.patch<LocationDetail>(
    `${locationsUrl(groupId)}/${locationId}`,
    body,
  );
  return data;
};

export function hasCoordinates(
  location: Pick<EventLocation, "latitude" | "longitude">,
): location is { latitude: number; longitude: number } {
  return location.latitude != null && location.longitude != null;
}

export function formatCoordinates(
  location: Pick<EventLocation, "latitude" | "longitude">,
  digits = 5,
): string | null {
  if (!hasCoordinates(location)) return null;
  return `${location.latitude.toFixed(digits)}, ${location.longitude.toFixed(digits)}`;
}
