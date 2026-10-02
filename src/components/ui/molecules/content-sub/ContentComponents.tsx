import { IoMdVideocam } from "react-icons/io";
import { IoMusicalNotesSharp, IoTextOutline } from "react-icons/io5";
import { MdOutlineImage } from "react-icons/md";
import { LuCalendarDays, LuLayers, LuNewspaper } from "react-icons/lu";
import { GiPrayerBeads } from "react-icons/gi";
import {
  getYouTubeVideoId,
  getYouTubeShortsId,
  extractSpotifyId,
} from "@/lib/utils";
import pechaIcon from "@/assets/icon/pecha_icon.png";
import { Badge } from "@/components/ui/atoms/badge";
import {
  LINKED_CONTENT_LABELS,
  type LinkedContentType,
  type SubTaskReference,
} from "@/components/ui/molecules/linked-content/linkedContent";

type ContentType =
  | "TEXT"
  | "IMAGE"
  | "AUDIO"
  | "VIDEO"
  | "SOURCE_REFERENCE"
  | LinkedContentType;

export const ContentIcon = ({ type }: { type: ContentType }) => {
  switch (type) {
    case "VIDEO":
      return <IoMdVideocam className="w-4 h-4 text-gray-600" />;
    case "TEXT":
      return <IoTextOutline className="w-4 h-4 text-gray-600" />;
    case "AUDIO":
      return <IoMusicalNotesSharp className="w-4 h-4 text-gray-600" />;
    case "IMAGE":
      return <MdOutlineImage className="w-4 h-4 text-gray-600" />;
    case "SOURCE_REFERENCE":
      return <img src={pechaIcon} alt="Pecha Icon" className="w-4 h-4" />;
    case "GROUP_ACCUMULATION":
      return <GiPrayerBeads className="w-4 h-4 text-gray-600" />;
    case "GROUP_COLLECTION":
      return <LuLayers className="w-4 h-4 text-gray-600" />;
    case "EVENT":
      return <LuCalendarDays className="w-4 h-4 text-gray-600" />;
    case "POST":
      return <LuNewspaper className="w-4 h-4 text-gray-600" />;
    default:
      return null;
  }
};

export const VideoContent = ({ content }: { content: string }) => {
  const regularVideoId = getYouTubeVideoId(content);
  const shortsVideoId = getYouTubeShortsId(content);
  const videoId = regularVideoId || shortsVideoId;

  if (!videoId) return null;

  return (
    <div className="mt-4">
      <iframe
        className={`w-full max-w-[315px] mx-auto rounded-md border bg-[#FAFAFA] dark:bg-sidebar-secondary ${shortsVideoId ? "aspect-[9/16]" : "aspect-[16/9]"}`}
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube preview"
      />
    </div>
  );
};

export const AudioContent = ({ content }: { content: string }) => {
  const getEmbedSrc = () => {
    if (content.includes("spotify.com")) {
      const data = extractSpotifyId(content);
      return data
        ? `https://open.spotify.com/embed/${data.type}/${data.id}?utm_source=generator`
        : null;
    }
    if (content.includes("soundcloud.com")) {
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(content)}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;
    }
    return null;
  };

  const src = getEmbedSrc();
  if (!src) return null;

  const audioTitle = content.includes("spotify.com")
    ? "Spotify audio player"
    : "SoundCloud audio player";

  return (
    <div className="mt-4 w-full rounded-md overflow-hidden bg-[#FAFAFA] dark:bg-sidebar-secondary ">
      <iframe
        src={src}
        title={audioTitle}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="w-full h-40 border-0"
      />
    </div>
  );
};

export const ImageContent = ({ content }: { content: string }) => (
  <div className="mt-4 flex mx-auto justify-center bg-[#FAFAFA] dark:bg-sidebar-secondary ">
    <div>
      <img
        src={content}
        alt="Task content"
        className="w-full h-48 object-cover rounded-lg border"
      />
    </div>
  </div>
);

export const TextContent = ({ content }: { content: string }) => (
  <div className="w-full min-h-64 max-h-56 overflow-y-auto bg-[#FAFAFA] dark:bg-sidebar-secondary  whitespace-pre-wrap text-base p-3 border rounded-md">
    {content}
  </div>
);

export const SourceReferenceContent = ({
  content,
  segmentNumbers,
  segmentRefs,
}: {
  content: string;
  segmentNumbers?: number[] | null;
  segmentRefs?: (string | null)[] | null;
}) => {
  const segments = content.split("\n").filter(Boolean);
  return (
    <div className="space-y-3">
      {segments.map((text, index) => {
        const label = segmentNumbers?.[index] ?? index + 1;
        const ref = segmentRefs?.[index];
        return (
          <div
            key={index}
            className="w-full min-h-12 bg-[#FAFAFA] dark:bg-sidebar-secondary whitespace-pre-wrap text-base p-3 border rounded-md border-dashed border-gray-300 dark:border-[#313132]"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium">{label}.</span>
              {ref && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  {ref}
                </Badge>
              )}
            </div>
            <span dangerouslySetInnerHTML={{ __html: text }} />
          </div>
        );
      })}
    </div>
  );
};

/**
 * Preview for a subtask that links to other content. `reference` is resolved
 * live by the backend, so it is absent when the target has been deleted.
 */
export const LinkedContent = ({
  type,
  reference,
  referenceId,
}: {
  type: LinkedContentType;
  reference?: SubTaskReference | null;
  referenceId?: string | null;
}) => {
  if (!reference) {
    return (
      <div className="mt-2 rounded-md border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3">
        <p className="text-sm font-medium">
          {referenceId
            ? `This ${LINKED_CONTENT_LABELS[type].toLowerCase()} is no longer available`
            : `No ${LINKED_CONTENT_LABELS[type].toLowerCase()} linked yet`}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {referenceId
            ? "It may have been deleted. Remove this subtask or link another one."
            : "Pick one from this plan's group."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-3 rounded-md border bg-[#FAFAFA] dark:bg-sidebar-secondary p-3">
      {reference.image_url ? (
        <img
          src={reference.image_url}
          alt=""
          className="w-14 h-14 rounded-md object-cover border shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-md border border-dashed shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <Badge variant="outline" className="text-[10px] font-normal mb-1">
          {LINKED_CONTENT_LABELS[type]}
        </Badge>
        <p className="font-medium truncate">
          {reference.title || LINKED_CONTENT_LABELS[type]}
        </p>
        {reference.subtitle && (
          <p className="text-sm text-muted-foreground truncate">
            {reference.subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
