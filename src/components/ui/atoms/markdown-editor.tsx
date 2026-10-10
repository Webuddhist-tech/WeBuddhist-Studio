import { useEffect, useRef, useState } from "react";
import { useTranslate } from "@tolgee/react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/atoms/textarea";
import { MarkdownToolbar } from "@/components/ui/molecules/markdown-editor/MarkdownToolbar";
import { MarkdownLinkDialog } from "@/components/ui/molecules/markdown-editor/MarkdownLinkDialog";
import { MarkdownPreview } from "@/components/ui/molecules/markdown-editor/MarkdownPreview";
import {
  buildMarkdownLink,
  getTextSelection,
  insertAtSelection,
  wrapSelection,
} from "@/components/ui/molecules/markdown-editor/markdownEditorUtils";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  textareaClassName?: string;
};

const MarkdownEditor = ({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  textareaClassName,
}: MarkdownEditorProps) => {
  const { t } = useTranslate();
  const [activeTab, setActiveTab] = useState<"write" | "preview">(
    disabled ? "preview" : "write",
  );
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkSelectionText, setLinkSelectionText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const savedSelection = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (!pendingSelection.current || !textareaRef.current) return;
    const { start, end } = pendingSelection.current;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(start, end);
    pendingSelection.current = null;
  }, [value]);

  const applyEdit = (
    nextValue: string,
    cursorStart: number,
    cursorEnd: number,
  ) => {
    pendingSelection.current = { start: cursorStart, end: cursorEnd };
    onChange(nextValue);
  };

  const withSelection = (
    edit: (
      currentValue: string,
      start: number,
      end: number,
    ) => { nextValue: string; cursorStart: number; cursorEnd: number },
  ) => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    const { start, end } = getTextSelection(value, textarea);
    const result = edit(value, start, end);
    applyEdit(result.nextValue, result.cursorStart, result.cursorEnd);
  };

  const handleBold = () => {
    withSelection((currentValue, start, end) =>
      wrapSelection(currentValue, start, end, "**", "**"),
    );
  };

  const handleItalic = () => {
    withSelection((currentValue, start, end) =>
      wrapSelection(currentValue, start, end, "*", "*"),
    );
  };

  const handleHeading = () => {
    withSelection((currentValue, start, end) => {
      const lineStart = currentValue.lastIndexOf("\n", start - 1) + 1;
      const prefix = "## ";
      const insertText = `${prefix}${currentValue.slice(start, end)}`;
      const nextValue =
        currentValue.slice(0, lineStart) + insertText + currentValue.slice(end);
      const cursorStart = lineStart + prefix.length;
      const cursorEnd = cursorStart + (end - start);
      return { nextValue, cursorStart, cursorEnd };
    });
  };

  const handleBulletList = () => {
    withSelection((currentValue, start, end) => {
      const selected = currentValue.slice(start, end);
      const lines = selected ? selected.split("\n") : [""];
      const formatted = lines.map((line) => `- ${line}`).join("\n");
      return insertAtSelection(currentValue, start, end, formatted);
    });
  };

  const handleNumberedList = () => {
    withSelection((currentValue, start, end) => {
      const selected = currentValue.slice(start, end);
      const lines = selected ? selected.split("\n") : [""];
      const formatted = lines
        .map((line, index) => `${index + 1}. ${line}`)
        .join("\n");
      return insertAtSelection(currentValue, start, end, formatted);
    });
  };

  const handleOpenLinkDialog = () => {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    const { start, end, text } = getTextSelection(value, textarea);
    savedSelection.current = { start, end };
    setLinkSelectionText(text);
    setIsLinkDialogOpen(true);
  };

  const handleInsertLink = ({ label, url }: { label: string; url: string }) => {
    const selection = savedSelection.current ?? {
      start: value.length,
      end: value.length,
    };
    const markdown = buildMarkdownLink(label, url);
    const result = insertAtSelection(
      value,
      selection.start,
      selection.end,
      markdown,
    );
    applyEdit(result.nextValue, result.cursorStart, result.cursorEnd);
    savedSelection.current = null;
  };

  return (
    <div className={cn("rounded-md border border-input", className)}>
      <div className="flex border-b border-input">
        <button
          type="button"
          onClick={() => setActiveTab("write")}
          disabled={disabled}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "write"
              ? "text-foreground border-b-2 border-foreground -mb-px"
              : "text-muted-foreground hover:text-foreground",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {t("studio.ui.markdown_editor.write")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "preview"
              ? "text-foreground border-b-2 border-foreground -mb-px"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("studio.ui.markdown_editor.preview")}
        </button>
      </div>

      {activeTab === "write" ? (
        <>
          <MarkdownToolbar
            disabled={disabled}
            onBold={handleBold}
            onItalic={handleItalic}
            onHeading={handleHeading}
            onBulletList={handleBulletList}
            onNumberedList={handleNumberedList}
            onLink={handleOpenLinkDialog}
          />
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "min-h-[100px] w-full border-0 rounded-none rounded-b-md focus-visible:ring-0 focus-visible:ring-offset-0 resize-y",
              textareaClassName,
            )}
          />
        </>
      ) : (
        <MarkdownPreview value={value} />
      )}

      <MarkdownLinkDialog
        open={isLinkDialogOpen}
        onOpenChange={setIsLinkDialogOpen}
        selectedText={linkSelectionText}
        onConfirm={handleInsertLink}
      />
    </div>
  );
};

export { MarkdownEditor };
