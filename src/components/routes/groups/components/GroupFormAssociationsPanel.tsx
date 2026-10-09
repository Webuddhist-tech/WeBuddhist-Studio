import PlanTagSearchInput from "@/components/routes/create-plan/PlanTagSearchInput";
import type { TagSummaryDTO } from "../api/groupsApi";
import { mapGroupTagsToPlanTagSummaries } from "../api/groupPickerApi";
import { GroupSectionHeader } from "./GroupSection";
import GroupSocialLinksEditor from "./GroupSocialLinksEditor";
import type { GroupSocialLinkDTO } from "../api/groupsApi";

type GroupFormAssociationsPanelProps = {
  tagIds: string[];
  onTagIdsChange: (ids: string[]) => void;
  initialTags: TagSummaryDTO[];
  socialLinks: GroupSocialLinkDTO[];
  onSocialLinksChange: (links: GroupSocialLinkDTO[]) => void;
};

const GroupFormAssociationsPanel = ({
  tagIds,
  onTagIdsChange,
  initialTags,
  socialLinks,
  onSocialLinksChange,
}: GroupFormAssociationsPanelProps) => (
  <div className="w-full xl:w-1/2 xl:min-w-0 xl:pl-8 space-y-10">
    <section className="space-y-4">
      <GroupSectionHeader title="Tags" />
      <PlanTagSearchInput
        value={tagIds}
        onChange={onTagIdsChange}
        hideLabel
        initialTags={mapGroupTagsToPlanTagSummaries(initialTags)}
      />
    </section>

    <section className="space-y-4">
      <GroupSectionHeader title="Social links" />
      <GroupSocialLinksEditor
        value={socialLinks}
        onChange={onSocialLinksChange}
        hideLabel
      />
    </section>
  </div>
);

export default GroupFormAssociationsPanel;
