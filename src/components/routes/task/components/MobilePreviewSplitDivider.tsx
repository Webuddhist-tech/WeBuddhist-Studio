import type { ComponentProps } from "react";
import { HiOutlineDeviceMobile } from "react-icons/hi";
import { cn } from "@/lib/utils";
import { useTranslate } from "@tolgee/react";

type MobilePreviewSplitDividerProps = ComponentProps<"div"> & {
  showPreview: boolean;
  onToggle: () => void;
};

const MobilePreviewSplitDivider = ({
  showPreview,
  onToggle,
  className,
  ...props
}: MobilePreviewSplitDividerProps) => {
  const { t } = useTranslate();
  return (
    <div
      {...props}
      className={cn(
        "relative z-10 flex w-2 shrink-0 items-center justify-center border-l border-gray-200 bg-muted/40 dark:border-gray-700",
        className,
      )}
    >
      <button
        type="button"
        aria-label={
          showPreview
            ? t("studio.task.preview.hide")
            : t("studio.task.preview.show")
        }
        title={
          showPreview
            ? t("studio.task.preview.hide")
            : t("studio.task.preview.show")
        }
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute left-1/2 top-1/2 z-20 flex h-8 w-8 -translate-x-6 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-background shadow-md transition-colors hover:bg-muted dark:border-gray-600"
      >
        <HiOutlineDeviceMobile className="h-4 w-4 text-blue-600" />
      </button>
    </div>
  );
};

export default MobilePreviewSplitDivider;
