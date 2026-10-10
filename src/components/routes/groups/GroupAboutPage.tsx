import { Link, useOutletContext } from "react-router-dom";
import { IoMdCreate } from "react-icons/io";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import type { LanguageCode } from "@/schema/SeriesSchema";
import { ROUTES } from "@/routes/paths";
import { languageLabelForCode, resolveGroupBannerUrl } from "./api/groupsApi";
import { canEditGroupSettings } from "./lib/groupPermissions";
import { GroupDetailCard } from "./components/GroupSection";
import GroupDraftBanner from "./components/GroupDraftBanner";
import { traditionLabel } from "./lib/groupTradition";
import type { GroupOutletContext } from "./GroupLayout";

const GroupAboutPage = () => {
  const { t } = useTranslate();
  const { group, groupId, myRole, readOnlyPlatform, canPublishGroup } =
    useOutletContext<GroupOutletContext>();
  const bannerUrl = resolveGroupBannerUrl(group);
  const memberCount = group.member_count ?? group.members.length;
  const canEdit = !readOnlyPlatform && canEditGroupSettings(myRole);

  return (
    <div className="space-y-6">
      <GroupDraftBanner group={group} canPublish={canPublishGroup} />

      {canEdit ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.groupEdit(groupId)}>
              <IoMdCreate className="w-4 h-4" />{" "}
              {t("studio.groups.pages.about.edit_about")}
            </Link>
          </Button>
        </div>
      ) : null}

      {bannerUrl ? (
        <img
          src={bannerUrl}
          alt=""
          className="w-full max-h-48 object-cover rounded-lg border"
        />
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <Pecha.Badge variant="outline">
          {group.is_public
            ? t("studio.groups.pages.visibility.public")
            : t("studio.groups.pages.visibility.private")}
        </Pecha.Badge>
        <Pecha.Badge variant={group.tradition ? "secondary" : "outline"}>
          {group.tradition
            ? traditionLabel(group.tradition)
            : t("studio.groups.pages.about.no_tradition")}
        </Pecha.Badge>
        <span className="text-muted-foreground">
          {memberCount === 1
            ? t("studio.groups.pages.about.member_count_one", {
                count: memberCount,
              })
            : t("studio.groups.pages.about.member_count_other", {
                count: memberCount,
              })}
        </span>
        <span className="text-muted-foreground">
          {group.follower_count === 1
            ? t("studio.groups.pages.about.follower_count_one", {
                count: group.follower_count,
              })
            : t("studio.groups.pages.about.follower_count_other", {
                count: group.follower_count,
              })}
        </span>
      </div>

      {group.metadata.length > 0 ? (
        <GroupDetailCard title={t("studio.groups.pages.about.about_title")}>
          <div className="space-y-4">
            {group.metadata.map((meta) => (
              <div
                key={meta.id ?? `${meta.language}-${meta.title}`}
                className="space-y-1"
              >
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {languageLabelForCode(meta.language as LanguageCode)}
                </p>
                <p className="font-medium">{meta.title}</p>
                {meta.sub_title?.trim() ? (
                  <p className="text-sm text-muted-foreground">
                    {meta.sub_title}
                  </p>
                ) : null}
                {meta.description?.trim() ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {meta.description}
                  </p>
                ) : null}
                {meta.description_long?.trim() ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {meta.description_long}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </GroupDetailCard>
      ) : null}

      {group.tags.length > 0 ? (
        <GroupDetailCard title={t("studio.groups.pages.about.tags_title")}>
          <div className="flex flex-wrap gap-2">
            {group.tags.map((tag) => (
              <Pecha.Badge key={tag.id} variant="secondary">
                {tag.name}
              </Pecha.Badge>
            ))}
          </div>
        </GroupDetailCard>
      ) : null}

      {group.social_links.length > 0 ? (
        <GroupDetailCard
          title={t("studio.groups.pages.about.social_links_title")}
        >
          <ul className="space-y-2">
            {group.social_links.map((link, index) => (
              <li key={`${link.platform}-${index}`} className="text-sm">
                <span className="font-medium capitalize">{link.platform}:</span>{" "}
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#A51C21] hover:underline break-all"
                >
                  {link.url}
                </a>
              </li>
            ))}
          </ul>
        </GroupDetailCard>
      ) : null}
    </div>
  );
};

export default GroupAboutPage;
