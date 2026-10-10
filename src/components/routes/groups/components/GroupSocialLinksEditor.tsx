import { IoMdAdd, IoMdClose } from "react-icons/io";
import { useTranslate } from "@tolgee/react";
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
  const { t } = useTranslate();
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
          <p className="text-sm font-bold">
            {t("studio.groups.components.associations.social_links")}
          </p>
        ) : (
          <span />
        )}
        <Button type="button" variant="outline" size="sm" onClick={addLink}>
          <IoMdAdd className="w-4 h-4" />{" "}
          {t("studio.groups.components.social_links.add_link")}
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.groups.components.social_links.empty")}
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
                    {t("studio.groups.components.social_links.platform")}
                  </label>
                  <Pecha.Select
                    value={link.platform}
                    onValueChange={(v) => updateLink(index, "platform", v)}
                  >
                    <Pecha.SelectTrigger className="w-full">
                      <Pecha.SelectValue
                        placeholder={t(
                          "studio.groups.components.social_links.platform",
                        )}
                      />
                    </Pecha.SelectTrigger>
                    <Pecha.SelectContent>
                      <Pecha.SelectItem value="website">
                        {t("studio.groups.components.social_links.website")}
                      </Pecha.SelectItem>
                      {SOCIAL_PLATFORMS.map((p) => (
                        <Pecha.SelectItem key={p.value} value={p.value}>
                          {p.value === "email"
                            ? t("studio.groups.components.members.email")
                            : p.label}
                        </Pecha.SelectItem>
                      ))}
                    </Pecha.SelectContent>
                  </Pecha.Select>
                </div>
                <div className="space-y-1 flex-1 w-full">
                  <label className="text-xs text-muted-foreground">
                    {t("studio.groups.components.social_links.url")}
                  </label>
                  <Pecha.Input
                    value={link.url}
                    onChange={(e) => updateLink(index, "url", e.target.value)}
                    placeholder="https://…"
                  />
                  {urlError && (
                    <p className="text-xs text-red-500">
                      {t("studio.groups.components.social_links.url_invalid", {
                        platform: link.platform,
                      })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  className="p-2 text-muted-foreground hover:text-foreground shrink-0"
                  aria-label={t(
                    "studio.groups.components.social_links.remove_link",
                  )}
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
