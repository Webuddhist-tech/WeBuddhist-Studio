import ReactMarkdown from "react-markdown";
import { useTranslate } from "@tolgee/react";
import { isDrawerLink, parseDrawerLink } from "@/lib/markdownLinks";
import { cn } from "@/lib/utils";

type MarkdownPreviewProps = {
  value: string;
  className?: string;
  emptyMessage?: string;
};

const MarkdownPreview = ({
  value,
  className,
  emptyMessage,
}: MarkdownPreviewProps) => {
  const { t } = useTranslate();
  return (
    <div
      className={cn(
        "min-h-[100px] w-full px-3 py-2 text-base",
        "prose prose-sm dark:prose-invert max-w-none",
        className,
      )}
    >
      {value ? (
        <ReactMarkdown
          components={{
            a: ({ href, children }) => {
              if (href && isDrawerLink(href)) {
                const target = parseDrawerLink(href);
                const badge =
                  target?.type === "group"
                    ? t("studio.editor.link.type_group")
                    : target?.type === "segment"
                      ? t("studio.editor.link.type_text")
                      : t("studio.editor.link.type_link");
                return (
                  <span className="inline-flex items-center gap-1 not-prose">
                    <a
                      href={href}
                      className="text-[#801A1E] underline underline-offset-2"
                    >
                      {children}
                    </a>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {badge}
                    </span>
                  </span>
                );
              }

              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#801A1E] underline underline-offset-2"
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {value}
        </ReactMarkdown>
      ) : (
        <p className="text-muted-foreground italic">
          {emptyMessage ?? t("studio.editor.nothing_to_preview")}
        </p>
      )}
    </div>
  );
};

export { MarkdownPreview };
