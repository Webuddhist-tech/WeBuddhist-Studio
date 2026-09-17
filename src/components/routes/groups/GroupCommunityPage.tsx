import { Navigate, useOutletContext } from "react-router-dom";
import { ROUTES } from "@/routes/paths";
import GroupCommunitySection from "./components/GroupCommunitySection";
import { canModerateGroupUsers } from "./lib/groupPermissions";
import type { GroupOutletContext } from "./GroupLayout";

const GroupCommunityPage = () => {
  const { groupId, myRole, readOnlyPlatform } =
    useOutletContext<GroupOutletContext>();

  if (readOnlyPlatform || !canModerateGroupUsers(myRole)) {
    return <Navigate to={ROUTES.group(groupId)} replace />;
  }

  return <GroupCommunitySection groupId={groupId} />;
};

export default GroupCommunityPage;
