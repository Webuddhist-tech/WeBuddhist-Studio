import { Link, useOutletContext } from "react-router-dom";
import { IoMdCreate } from "react-icons/io";
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
              <IoMdCreate className="w-4 h-4" /> Edit about
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
          {group.is_public ? "Public" : "Private"}
        </Pecha.Badge>
        <Pecha.Badge variant={group.tradition ? "secondary" : "outline"}>
          {group.tradition
            ? traditionLabel(group.tradition)
            : "No tradition set"}
        </Pecha.Badge>
        <span className="text-muted-foreground">
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground">
          {group.follower_count} follower
          {group.follower_count === 1 ? "" : "s"}
        </span>
      </div>

      {group.metadata.length > 0 ? (
        <GroupDetailCard title="About">
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
        <GroupDetailCard title="Tags">
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
        <GroupDetailCard title="Social links">
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
