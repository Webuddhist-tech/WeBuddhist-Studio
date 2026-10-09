import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/atoms/hover-card";
import { Badge } from "@/components/ui/atoms/badge";
import {
  fetchGroup,
  pickGroupTitle,
  resolveGroupAvatarUrl,
  type GroupMetadataDTO,
} from "@/components/routes/groups/api/groupsApi";
import type { GroupInfo } from "./api/verseOfDayApi";

interface VerseOfDayPageCellProps {
  pageId: string | null;
  pageInfo?: GroupInfo[];
}

const pickMetadata = <T extends { language: string }>(
  entries: T[] | undefined,
): T | undefined =>
  entries?.find((m) => m.language?.toUpperCase() === "EN") ?? entries?.[0];

const toMetadata = (info: GroupInfo[] | undefined): GroupMetadataDTO[] =>
  (info ?? []).map((i) => ({
    title: i.title,
    sub_title: i.sub_title,
    description: i.description,
    language: i.language.toUpperCase(),
  }));

const VerseOfDayPageCell = ({ pageId, pageInfo }: VerseOfDayPageCellProps) => {
  const [open, setOpen] = useState(false);
  const fallbackMetadata = toMetadata(pageInfo);

  const { data: page, isLoading } = useQuery({
    queryKey: ["verse-of-day-page-preview", pageId],
    queryFn: () => fetchGroup(pageId as string),
    enabled: open && !!pageId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!pageId) {
    return <span className="text-muted-foreground">—</span>;
  }

  const metadata = page?.metadata?.length ? page.metadata : fallbackMetadata;
  const title = pickGroupTitle(metadata, "Untitled page");
  const details = pickMetadata(metadata);
  const avatarUrl = page ? resolveGroupAvatarUrl(page) : null;
  const tags = page?.tags ?? [];

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={200}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="max-w-full truncate text-left text-sm underline decoration-dotted underline-offset-4 hover:text-foreground"
        >
          {title}
        </button>
      </HoverCardTrigger>
      <HoverCardContent aria-label={`Details of page ${title}`}>
        <div className="flex gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-md object-cover"
            />
          ) : null}
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">{title}</p>
            {details?.sub_title ? (
              <p className="text-xs text-muted-foreground">
                {details.sub_title}
              </p>
            ) : null}
          </div>
        </div>
        {details?.description ? (
          <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">
            {details.description}
          </p>
        ) : null}
        {page ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {page.status ? (
              <Badge variant="outline">{page.status.toLowerCase()}</Badge>
            ) : null}
            <Badge variant="outline">
              {page.is_public ? "Public" : "Private"}
            </Badge>
            {page.tradition?.name ? (
              <Badge variant="outline">{page.tradition.name}</Badge>
            ) : null}
            {tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}
        {page ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {page.follower_count} follower
            {page.follower_count === 1 ? "" : "s"}
          </p>
        ) : isLoading ? (
          <p className="mt-3 text-xs text-muted-foreground">Loading…</p>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
};

export default VerseOfDayPageCell;
