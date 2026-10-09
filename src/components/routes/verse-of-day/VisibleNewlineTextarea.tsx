import { useRef } from "react";
import { Textarea } from "@/components/ui/atoms/textarea";
import { cn } from "@/lib/utils";

export const NEWLINE_MARKER = "↵";

interface VisibleNewlineTextareaProps
  extends Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * A textarea that draws a marker at the end of every line break, so an
 * intentional newline can be told apart from text that merely wraps.
 * The markers sit on a transparent overlay that mirrors the textarea's
 * text metrics; only the markers are visible, and it never takes clicks.
 * Each marker is zero-width so it cannot change where the text wraps.
 */
const VisibleNewlineTextarea = ({
  value,
  onValueChange,
  className,
  ...props
}: VisibleNewlineTextareaProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const lines = value.split("\n");

  return (
    <div className="relative">
      <Textarea
        {...props}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onScroll={(e) => {
          if (overlayRef.current) {
            overlayRef.current.scrollTop = e.currentTarget.scrollTop;
          }
        }}
        className={className}
      />
      <div
        ref={overlayRef}
        aria-hidden="true"
        data-testid="newline-markers"
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent px-3 py-2 text-base md:text-sm",
          "whitespace-pre-wrap break-words text-transparent",
        )}
      >
        {lines.map((line, index) => (
          <span key={index}>
            {line}
            {index < lines.length - 1 ? (
              <>
                <span className="inline-block w-0 select-none overflow-visible whitespace-nowrap pl-0.5 text-muted-foreground/70">
                  {NEWLINE_MARKER}
                </span>
                {"\n"}
              </>
            ) : null}
          </span>
        ))}
        {/* Keeps a trailing empty line the same height as in the textarea. */}
        {"​"}
      </div>
    </div>
  );
};

export default VisibleNewlineTextarea;
