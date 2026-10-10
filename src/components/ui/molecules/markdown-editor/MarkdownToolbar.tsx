import { Button } from "@/components/ui/atoms/button";
import { useTranslate } from "@tolgee/react";
import { cn } from "@/lib/utils";
import {
  LuBold,
  LuHeading2,
  LuItalic,
  LuLink,
  LuList,
  LuListOrdered,
} from "react-icons/lu";

type MarkdownToolbarProps = {
  disabled?: boolean;
  onBold: () => void;
  onItalic: () => void;
  onHeading: () => void;
  onBulletList: () => void;
  onNumberedList: () => void;
  onLink: () => void;
  className?: string;
};

const MarkdownToolbar = ({
  disabled,
  onBold,
  onItalic,
  onHeading,
  onBulletList,
  onNumberedList,
  onLink,
  className,
}: MarkdownToolbarProps) => {
  const { t } = useTranslate();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 border-b border-input px-2 py-1.5",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={disabled}
        onClick={onBold}
        aria-label={t("studio.editor.toolbar.bold")}
      >
        <LuBold />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={disabled}
        onClick={onItalic}
        aria-label={t("studio.editor.toolbar.italic")}
      >
        <LuItalic />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={disabled}
        onClick={onHeading}
        aria-label={t("studio.editor.toolbar.heading")}
      >
        <LuHeading2 />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={disabled}
        onClick={onBulletList}
        aria-label={t("studio.editor.toolbar.bullet_list")}
      >
        <LuList />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={disabled}
        onClick={onNumberedList}
        aria-label={t("studio.editor.toolbar.numbered_list")}
      >
        <LuListOrdered />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={disabled}
        onClick={onLink}
        aria-label={t("studio.editor.link.insert")}
      >
        <LuLink />
      </Button>
    </div>
  );
};

export { MarkdownToolbar };
