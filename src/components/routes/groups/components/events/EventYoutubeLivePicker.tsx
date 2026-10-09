import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiYoutube } from "react-icons/si";
import { format } from "date-fns";
import { Pecha } from "@/components/ui/shadimport";
import {
  fetchYoutubeChannelLiveVideos,
  type YoutubeLiveStatus,
  type YoutubeLiveVideo,
} from "../../api/youtubeChannelApi";

type EventYoutubeLivePickerProps = {
  channelUrl: string;
  onSelect: (video: YoutubeLiveVideo) => void;
};

const STATUS_GROUPS: { status: YoutubeLiveStatus; heading: string }[] = [
  { status: "live", heading: "Live now" },
  { status: "upcoming", heading: "Upcoming" },
  { status: "completed", heading: "Past live streams" },
];

const formatStart = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : format(date, "PPp");
};

/** Lets the user fill a YouTube row from the group channel's live streams. */
const EventYoutubeLivePicker = ({
  channelUrl,
  onSelect,
}: EventYoutubeLivePickerProps) => {
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["youtube-channel-live-videos", channelUrl],
    queryFn: () => fetchYoutubeChannelLiveVideos(channelUrl),
    enabled: open,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const videos = data ?? [];

  return (
    <Pecha.Popover open={open} onOpenChange={setOpen}>
      <Pecha.PopoverTrigger asChild>
        <Pecha.Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
        >
          <SiYoutube className="h-4 w-4 text-[#FF0000]" /> Choose from group
          channel
        </Pecha.Button>
      </Pecha.PopoverTrigger>
      <Pecha.PopoverContent
        className="w-[420px] max-w-[90vw] p-0"
        align="start"
      >
        <Pecha.Command>
          <Pecha.CommandInput placeholder="Search live streams…" />
          <Pecha.CommandList className="max-h-80">
            {isLoading ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Loading live streams…
              </div>
            ) : isError ? (
              <div className="space-y-2 px-3 py-6 text-center text-sm">
                <p className="text-destructive">
                  {error instanceof Error
                    ? error.message
                    : "Could not load live streams."}
                </p>
                <Pecha.Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                >
                  Retry
                </Pecha.Button>
              </div>
            ) : (
              <>
                <Pecha.CommandEmpty>
                  No live streams found on this channel.
                </Pecha.CommandEmpty>
                {STATUS_GROUPS.map(({ status, heading }) => {
                  const items = videos.filter((v) => v.status === status);
                  if (!items.length) return null;
                  return (
                    <Pecha.CommandGroup key={status} heading={heading}>
                      {items.map((video) => (
                        <Pecha.CommandItem
                          key={video.id}
                          value={`${video.title} ${video.id}`}
                          onSelect={() => {
                            onSelect(video);
                            setOpen(false);
                          }}
                          className="flex cursor-pointer items-center gap-2"
                        >
                          {video.thumbnail ? (
                            <img
                              src={video.thumbnail}
                              alt=""
                              className="h-9 w-16 shrink-0 rounded object-cover"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{video.title}</p>
                            {formatStart(video.startTime) ? (
                              <p className="text-xs text-muted-foreground">
                                {formatStart(video.startTime)}
                              </p>
                            ) : null}
                          </div>
                        </Pecha.CommandItem>
                      ))}
                    </Pecha.CommandGroup>
                  );
                })}
              </>
            )}
          </Pecha.CommandList>
        </Pecha.Command>
      </Pecha.PopoverContent>
    </Pecha.Popover>
  );
};

export default EventYoutubeLivePicker;
