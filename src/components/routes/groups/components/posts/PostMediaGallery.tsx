import { useState } from "react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { useTranslate } from "@tolgee/react";
import type { GroupPostMediaDTO } from "../../api/groupPostsApi";

type PostMediaGalleryProps = {
  media: GroupPostMediaDTO[];
};

const PostMediaGallery = ({ media }: PostMediaGalleryProps) => {
  const { t } = useTranslate();
  const orderedMedia = [...media].sort(
    (left, right) => left.display_order - right.display_order,
  );
  const [activeIndex, setActiveIndex] = useState(0);

  if (orderedMedia.length === 0) return null;

  const activeMedia = orderedMedia[activeIndex] ?? orderedMedia[0];
  const mediaUrl = activeMedia.url ?? activeMedia.thumbnail_url;
  const hasMultiple = orderedMedia.length > 1;

  const showPrevious = () => {
    setActiveIndex((current) =>
      current === 0 ? orderedMedia.length - 1 : current - 1,
    );
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % orderedMedia.length);
  };

  return (
    <div className="relative overflow-hidden bg-black">
      <div className="flex aspect-square max-h-[640px] items-center justify-center">
        {activeMedia.media_type === "VIDEO" && mediaUrl ? (
          <video
            key={activeMedia.id}
            src={mediaUrl}
            poster={activeMedia.thumbnail_url ?? undefined}
            controls
            className="h-full w-full object-contain"
          />
        ) : activeMedia.media_type === "AUDIO" && mediaUrl ? (
          <div className="flex w-full flex-col items-center gap-4 px-8 text-white">
            <div className="text-sm font-medium">
              {t("studio.common.audio")}
            </div>
            <audio
              key={activeMedia.id}
              src={mediaUrl}
              controls
              className="w-full"
            />
          </div>
        ) : mediaUrl ? (
          <img src={mediaUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="text-sm text-white/70">
            {t("studio.groups.posts.media.unavailable")}
          </div>
        )}
      </div>

      {hasMultiple ? (
        <>
          <button
            type="button"
            aria-label={t("studio.groups.posts.media.previous_aria")}
            onClick={showPrevious}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white transition hover:bg-black/75"
          >
            <IoChevronBack className="size-5" />
          </button>
          <button
            type="button"
            aria-label={t("studio.groups.posts.media.next_aria")}
            onClick={showNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white transition hover:bg-black/75"
          >
            <IoChevronForward className="size-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {orderedMedia.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={t("studio.groups.posts.media.show_aria", {
                  index: index + 1,
                })}
                onClick={() => setActiveIndex(index)}
                className={`size-2 rounded-full ${
                  index === activeIndex ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
            {activeIndex + 1}/{orderedMedia.length}
          </span>
        </>
      ) : null}
    </div>
  );
};

export default PostMediaGallery;
