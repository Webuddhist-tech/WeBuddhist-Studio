import { useEffect, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { IoMdAdd, IoMdClose, IoMdCreate } from "react-icons/io";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { MdLocationOn } from "react-icons/md";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  parseCoordinates,
  type LocationFormData,
} from "@/schema/LocationSchema";
import {
  createLocation,
  fetchLocation,
  fetchLocations,
  formatCoordinates,
  updateLocation,
  type EventLocation,
  type LocationDetail,
  type LocationTranslation,
} from "../../api/locationsApi";
import LocationFormDialog from "./LocationFormDialog";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 600;

type LocationPickerProps = {
  groupId: string;
  value: EventLocation | null;
  onChange: (location: EventLocation | null) => void;
  readOnly?: boolean;
  canCreate?: boolean;
};

function translationsPayload(data: LocationFormData): LocationTranslation[] {
  return data.translations.map((entry) => ({
    language: entry.language,
    name: entry.name.trim(),
  }));
}

function locationSubtitle(location: LocationDetail): string {
  const coords = formatCoordinates(location, 4);
  const uses = `used by ${location.event_count} event${
    location.event_count === 1 ? "" : "s"
  }`;
  return coords ? `${coords} · ${uses}` : uses;
}

const LocationPicker = ({
  groupId,
  value,
  onChange,
  readOnly = false,
  canCreate = true,
}: LocationPickerProps) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editLocationId, setEditLocationId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQuery(searchQuery.trim()),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["group-locations", groupId, debouncedQuery],
      queryFn: ({ pageParam = 0 }) =>
        fetchLocations(groupId, {
          search: debouncedQuery || undefined,
          skip: pageParam,
          limit: PAGE_SIZE,
        }),
      getNextPageParam: (lastPage) => {
        const fetched = lastPage.skip + lastPage.locations.length;
        return fetched < lastPage.total ? fetched : undefined;
      },
      initialPageParam: 0,
      enabled: Boolean(groupId) && isDropdownOpen && !readOnly,
    });

  const results: LocationDetail[] =
    data?.pages.flatMap((page) => page.locations) ?? [];

  const { ref: sentinelRef, inView } = useInView({ threshold: 0 });
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const createMutation = useMutation({
    mutationFn: (data: LocationFormData) => {
      const coords = parseCoordinates(data);
      return createLocation(groupId, {
        name: data.name.trim(),
        ...(coords.latitude != null && coords.longitude != null
          ? { latitude: coords.latitude, longitude: coords.longitude }
          : {}),
        translations: translationsPayload(data),
      });
    },
    onSuccess: (created) => {
      toast.success("Location created");
      queryClient.invalidateQueries({ queryKey: ["group-locations", groupId] });
      onChange(created);
      setCreateOpen(false);
      setSearchQuery("");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  // Edited from its id rather than from the row in hand: the selected value can
  // come from an event read, which carries only the localized name, and saving
  // from that would wipe the other languages.
  const { data: editLocation } = useQuery({
    queryKey: ["group-location", groupId, editLocationId],
    queryFn: () => fetchLocation(groupId, editLocationId!),
    enabled: Boolean(groupId) && Boolean(editLocationId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: LocationFormData) => {
      const coords = parseCoordinates(data);
      return updateLocation(groupId, editLocationId!, {
        name: data.name.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        translations: translationsPayload(data),
      });
    },
    onSuccess: (updated) => {
      toast.success("Location updated");
      queryClient.invalidateQueries({ queryKey: ["group-locations", groupId] });
      queryClient.invalidateQueries({
        queryKey: ["group-location", groupId, updated.id],
      });
      if (value?.id === updated.id) onChange(updated);
      setEditLocationId(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleSelect = (location: LocationDetail) => {
    onChange(location);
    setIsDropdownOpen(false);
    setSearchQuery("");
  };

  // Reachable from both the selected row and the dropdown list, so it is built
  // once here. The id guard keeps a previously fetched location from flashing
  // up while the next one loads.
  const editDialog =
    editLocation && editLocation.id === editLocationId ? (
      <LocationFormDialog
        open
        onOpenChange={(open) => {
          if (!open) setEditLocationId(null);
        }}
        location={editLocation}
        isSubmitting={updateMutation.isPending}
        onSubmit={(data) => updateMutation.mutate(data)}
      />
    ) : null;

  const trimmedQuery = searchQuery.trim();
  const nearMatch = trimmedQuery
    ? results.find(
        (item) => item.name.toLowerCase() === trimmedQuery.toLowerCase(),
      )
    : undefined;

  if (value) {
    const coords = formatCoordinates(value, 4);
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Location</p>
        <div className="flex items-center gap-2 rounded-md border border-input bg-white p-2 dark:bg-[#262626]">
          <MdLocationOn className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{value.name}</span>
            {coords ? (
              <span className="block truncate text-xs text-muted-foreground">
                {coords}
              </span>
            ) : null}
          </span>
          {!readOnly ? (
            <>
              {canCreate ? (
                <button
                  type="button"
                  onClick={() => setEditLocationId(value.id)}
                  aria-label={`Edit ${value.name}`}
                  className="shrink-0 cursor-pointer p-1 text-muted-foreground hover:text-foreground"
                >
                  <IoMdCreate className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onChange(null)}
                aria-label={`Remove ${value.name}`}
                className="shrink-0 cursor-pointer p-1 text-muted-foreground hover:text-foreground"
              >
                <IoMdClose className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>

        {editDialog}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Location</p>

      <div className="relative">
        <FaMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search saved locations…"
          value={searchQuery}
          disabled={readOnly}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsDropdownOpen(true)}
          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
          className="h-11 w-full rounded-md border border-input bg-white pl-10 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#262626] dark:text-white"
        />

        {isDropdownOpen && !readOnly && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-background shadow-md dark:bg-[#262626]">
            {isLoading && results.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Searching…
              </div>
            )}

            {results.map((item) => (
              <div
                key={item.id}
                className="flex items-center hover:bg-gray-100 dark:hover:bg-[#333333]"
              >
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-2 text-left"
                >
                  <MdLocationOn className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {locationSubtitle(item)}
                    </span>
                  </span>
                </button>
                {canCreate ? (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setEditLocationId(item.id);
                      setIsDropdownOpen(false);
                    }}
                    aria-label={`Edit ${item.name}`}
                    className="shrink-0 cursor-pointer px-3 py-2 text-muted-foreground hover:text-foreground"
                  >
                    <IoMdCreate className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}

            {hasNextPage && (
              <div
                ref={sentinelRef}
                className="px-3 py-2 text-center text-xs text-muted-foreground"
              >
                {isFetchingNextPage ? "Loading more…" : ""}
              </div>
            )}

            {!isLoading && results.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {debouncedQuery
                  ? "No saved locations match."
                  : "No saved locations yet."}
              </div>
            )}

            {canCreate && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setCreateOpen(true);
                  setIsDropdownOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2 border-t border-input px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-[#333333]"
              >
                <IoMdAdd className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {trimmedQuery
                    ? `Create “${trimmedQuery}”`
                    : "Create a new location"}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {nearMatch && canCreate ? (
        <p className="text-xs text-muted-foreground">
          There is already a location called “{nearMatch.name}” (
          {locationSubtitle(nearMatch)}).{" "}
          <button
            type="button"
            onClick={() => handleSelect(nearMatch)}
            className="cursor-pointer underline hover:text-foreground"
          >
            Use it instead
          </button>
        </p>
      ) : null}

      <LocationFormDialog
        open={isCreateOpen}
        onOpenChange={setCreateOpen}
        location={null}
        initialName={trimmedQuery}
        isSubmitting={createMutation.isPending}
        onSubmit={(data) => createMutation.mutate(data)}
      />

      {editDialog}
    </div>
  );
};

export default LocationPicker;
