import { IoMdAdd, IoMdClose } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { SOCIAL_PLATFORMS } from "@/lib/constant";
import type { GroupSocialLinkDTO } from "../api/groupsApi";
import { getSocialLinkUrlError } from "../lib/groupSocialLinks";

type GroupSocialLinksEditorProps = {
  value: GroupSocialLinkDTO[];
  onChange: (links: GroupSocialLinkDTO[]) => void;
  hideLabel?: boolean;
};

const GroupSocialLinksEditor = ({
  value,
  onChange,
  hideLabel = false,
}: GroupSocialLinksEditorProps) => {
  const addLink = () => {
    onChange([...value, { platform: "website", url: "" }]);
  };

  const updateLink = (
    index: number,
    field: keyof GroupSocialLinkDTO,
    fieldValue: string,
  ) => {
    const next = value.map((link, i) =>
      i === index ? { ...link, [field]: fieldValue } : link,
    );
    onChange(next);
  };

  const removeLink = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {!hideLabel ? (
          <p className="text-sm font-bold">Social links</p>
        ) : (
          <span />
        )}
        <Button type="button" variant="outline" size="sm" onClick={addLink}>
          <IoMdAdd className="w-4 h-4" /> Add link
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No social links yet. Add platforms like website, X, or YouTube.
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((link, index) => {
            const urlError = getSocialLinkUrlError(link.platform, link.url);
            return (
              <div
                key={index}
                className="flex flex-col sm:flex-row gap-2 items-start sm:items-end border rounded-md p-3"
              >
                <div className="space-y-1 w-full sm:w-40">
                  <label className="text-xs text-muted-foreground">
                    Platform
                  </label>
                  <Pecha.Select
                    value={link.platform}
                    onValueChange={(v) => updateLink(index, "platform", v)}
                  >
                    <Pecha.SelectTrigger className="w-full">
                      <Pecha.SelectValue placeholder="Platform" />
                    </Pecha.SelectTrigger>
                    <Pecha.SelectContent>
                      <Pecha.SelectItem value="website">
                        Website
                      </Pecha.SelectItem>
                      {SOCIAL_PLATFORMS.map((p) => (
                        <Pecha.SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </Pecha.SelectItem>
                      ))}
                    </Pecha.SelectContent>
                  </Pecha.Select>
                </div>
                <div className="space-y-1 flex-1 w-full">
                  <label className="text-xs text-muted-foreground">URL</label>
                  <Pecha.Input
                    value={link.url}
                    onChange={(e) => updateLink(index, "url", e.target.value)}
                    placeholder="https://…"
                  />
                  {urlError && (
                    <p className="text-xs text-red-500">{urlError}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  className="p-2 text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Remove link"
                >
                  <IoMdClose className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GroupSocialLinksEditor;
