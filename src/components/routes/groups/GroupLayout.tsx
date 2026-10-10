import { useState } from "react";
import {
  matchPath,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IoMdTrash } from "react-icons/io";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo } from "@/hooks/useUserInfo";
import { ROUTES } from "@/routes/paths";
import { isReviewer } from "@/lib/platformAccess";
import { cn } from "@/lib/utils";
import {
  canChangeGroupStatus,
  canDeleteGroup,
  canManageGroupInvites,
  canManageJoinRequests,
  canModerateGroupUsers,
  getEffectiveGroupRole,
} from "./lib/groupPermissions";
import {
  deleteGroup,
  fetchGroup,
  pickGroupTitle,
  resolveGroupAvatarUrl,
  type AuthorGroupDetailDTO,
  type AuthorGroupMemberRole,
} from "./api/groupsApi";
import { fetchGroupJoinRequests } from "./api/groupJoinRequestsApi";
import { GroupPageShell } from "./components/GroupPageShell";
import GroupStatusBadge from "./components/GroupStatusBadge";
import GroupPublishControl from "./components/GroupPublishControl";
import { groupKindOf } from "./lib/groupKind";
import { canWriteEvents } from "./lib/eventPermissions";
import PrayerPdfActions from "./components/prayer-pdf/PrayerPdfActions";
import type { UserInfo } from "@/hooks/useUserInfo";

export type GroupOutletContext = {
  group: AuthorGroupDetailDTO;
  groupId: string;
  myRole: AuthorGroupMemberRole | undefined;
  userInfo: UserInfo | null | undefined;
  readOnlyPlatform: boolean;
  canManageTransfers: boolean;
  canPublishGroup: boolean;
};

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "px-3 py-2 text-sm border-b-2 -mb-px transition-colors max-md:shrink-0 max-md:whitespace-nowrap",
    isActive
      ? "border-[#A51C21] text-foreground font-medium"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

const GroupLayout = () => {
  const { t } = useTranslate();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: userInfo } = useUserInfo();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const {
    data: group,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["cms-group", groupId],
    queryFn: () => fetchGroup(groupId!),
    enabled: Boolean(groupId),
    refetchOnWindowFocus: false,
  });

  const moderatesGroup =
    !isReviewer(userInfo?.platform_role) &&
    canManageJoinRequests(
      getEffectiveGroupRole(group?.members ?? [], userInfo),
    );

  const { data: pendingJoinRequests } = useQuery({
    queryKey: ["cms-group-join-requests-count", groupId],
    // limit 1: only `total` is used, so there is no need to pull the rows.
    queryFn: () =>
      fetchGroupJoinRequests(groupId!, { status: "PENDING", limit: 1 }),
    enabled: Boolean(groupId) && moderatesGroup,
    refetchOnWindowFocus: true,
  });

  const kind = groupKindOf(group?.group_type);
  const isCommunity = kind.type === "COMMUNITY";

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId!),
    onSuccess: () => {
      toast.success(
        t(
          isCommunity
            ? "studio.groups.pages.layout.deleted_community"
            : "studio.groups.pages.layout.deleted_page",
        ),
      );
      setDeleteOpen(false);
      setConfirmName("");
      queryClient.invalidateQueries({ queryKey: ["cms-groups"] });
      navigate(kind.listPath);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  if (groupId && searchParams.get("tab") === "transfers") {
    return <Navigate to={ROUTES.groupTransfers(groupId)} replace />;
  }

  if (!groupId) return null;

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-40px)] items-center justify-center text-muted-foreground max-md:h-full">
        {t("studio.common.loading")}
      </div>
    );
  }

  if (isError || !group) {
    return (
      <div className="flex h-[calc(100vh-40px)] flex-col items-center justify-center gap-4 max-md:h-full">
        <p className="text-destructive">
          {getApiErrorMessage(
            error,
            t("studio.groups.pages.layout.load_failed"),
          )}
        </p>
        <Button variant="outline" onClick={() => navigate(ROUTES.groups)}>
          {t("studio.groups.pages.layout.back_to_practice_spaces")}
        </Button>
      </div>
    );
  }

  const groupTitle = pickGroupTitle(group.metadata);
  const avatarUrl = resolveGroupAvatarUrl(group);
  const myRole = getEffectiveGroupRole(group.members ?? [], userInfo);
  const canDelete = canDeleteGroup(myRole);
  const canManageTransfers =
    canManageGroupInvites(myRole) || myRole === "OWNER";
  const readOnlyPlatform = isReviewer(userInfo?.platform_role);
  const showTransfersNav = !readOnlyPlatform;
  const showJoinRequestsNav =
    !readOnlyPlatform && canManageJoinRequests(myRole);
  const showCommunityNav = !readOnlyPlatform && canModerateGroupUsers(myRole);
  const pendingCount = pendingJoinRequests?.total ?? 0;
  const showDelete = !readOnlyPlatform && canDelete;
  const canPublishGroup = !readOnlyPlatform && canChangeGroupStatus(myRole);
  // Same roles the server lets export prayer requests; reviewers are excluded there too.
  const canExportPrayers =
    !readOnlyPlatform && canWriteEvents(myRole, userInfo?.platform_role);
  const nameMatches =
    confirmName.trim().toLowerCase() === groupTitle.trim().toLowerCase();
  const isAboutSection =
    Boolean(
      matchPath({ path: "/groups/:groupId", end: true }, location.pathname),
    ) ||
    Boolean(
      matchPath(
        { path: "/groups/:groupId/edit", end: true },
        location.pathname,
      ),
    );
  const isEditRoute = Boolean(
    matchPath({ path: "/groups/:groupId/edit", end: true }, location.pathname),
  );
  const contentMaxWidth = isEditRoute ? "max-w-6xl" : "max-w-4xl";

  const handleDeleteOpenChange = (open: boolean) => {
    setDeleteOpen(open);
    if (!open) setConfirmName("");
  };

  const outletContext: GroupOutletContext = {
    group,
    groupId: group.id,
    myRole,
    userInfo,
    readOnlyPlatform,
    canManageTransfers,
    canPublishGroup,
  };

  return (
    <>
      <GroupPageShell
        backLabel={`← ${t(
          isCommunity
            ? "studio.groups.pages.layout.back_label_community"
            : "studio.groups.pages.layout.back_label_page",
        )}`}
        onBack={() => navigate(kind.listPath)}
        title={groupTitle}
        avatarUrl={avatarUrl}
        subtitle={
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground font-mono">
              /{group.slug}
            </p>
            <GroupStatusBadge status={group.status} />
          </div>
        }
        headerActions={
          <>
            {canExportPrayers ? (
              <PrayerPdfActions scope={{ kind: "group", groupId: group.id }} />
            ) : null}
            {canPublishGroup ? <GroupPublishControl group={group} /> : null}
            {showDelete ? (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <IoMdTrash className="w-4 h-4" /> {t("studio.common.delete")}
              </Button>
            ) : null}
          </>
        }
        nav={
          <nav className="flex flex-wrap gap-1 px-4 sm:px-8 border-b border-dashed border-gray-300 dark:border-input max-md:flex-nowrap max-md:overflow-x-auto">
            <NavLink
              to={ROUTES.group(group.id)}
              end
              className={() => navLinkClass({ isActive: isAboutSection })}
            >
              {t("studio.groups.pages.layout.nav_about")}
            </NavLink>
            <NavLink
              to={ROUTES.groupContent(group.id)}
              className={navLinkClass}
            >
              {t("studio.groups.pages.layout.nav_content")}
            </NavLink>
            {showTransfersNav ? (
              <NavLink
                to={ROUTES.groupTransfers(group.id)}
                className={navLinkClass}
              >
                {t("studio.groups.pages.layout.nav_transfers")}
              </NavLink>
            ) : null}
            <NavLink
              to={ROUTES.groupMembers(group.id)}
              className={navLinkClass}
            >
              {t("studio.groups.pages.layout.nav_members")}
            </NavLink>
            {showCommunityNav ? (
              <NavLink
                to={ROUTES.groupCommunity(group.id)}
                className={navLinkClass}
              >
                {t("studio.groups.pages.layout.nav_community")}
              </NavLink>
            ) : null}
            {showJoinRequestsNav ? (
              <NavLink
                to={ROUTES.groupJoinRequests(group.id)}
                className={navLinkClass}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t("studio.groups.pages.layout.nav_join_requests")}
                  {pendingCount > 0 ? (
                    <span
                      className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#A51C21] px-1 text-[10px] font-medium text-white"
                      aria-label={t(
                        "studio.groups.pages.layout.pending_count",
                        {
                          count: pendingCount,
                        },
                      )}
                    >
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            ) : null}
            <NavLink to={ROUTES.groupEvents(group.id)} className={navLinkClass}>
              {t("studio.groups.pages.layout.nav_events")}
            </NavLink>
            <NavLink to={ROUTES.groupPosts(group.id)} className={navLinkClass}>
              {t("studio.groups.pages.layout.nav_posts")}
            </NavLink>
            <NavLink to={ROUTES.groupChants(group.id)} className={navLinkClass}>
              {t("studio.groups.pages.layout.nav_chants")}
            </NavLink>
            <NavLink to={ROUTES.groupAssets(group.id)} className={navLinkClass}>
              {t("studio.groups.pages.layout.nav_assets")}
            </NavLink>
          </nav>
        }
      >
        <div className="px-4 sm:px-8 py-6 pb-12 max-md:py-4">
          <div className={cn("mx-auto w-full", contentMaxWidth)}>
            <Outlet context={outletContext} />
          </div>
        </div>
      </GroupPageShell>

      <Pecha.AlertDialog
        open={deleteOpen}
        onOpenChange={handleDeleteOpenChange}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t(
                isCommunity
                  ? "studio.groups.pages.layout.delete_title_community"
                  : "studio.groups.pages.layout.delete_title_page",
              )}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {t(
                isCommunity
                  ? "studio.groups.pages.layout.delete_description_community"
                  : "studio.groups.pages.layout.delete_description_page",
                { title: groupTitle },
              )}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <div className="space-y-2 py-2">
            <label
              htmlFor="delete-group-confirm-name"
              className="text-sm font-medium"
            >
              {t(
                isCommunity
                  ? "studio.groups.pages.layout.name_label_community"
                  : "studio.groups.pages.layout.name_label_page",
              )}
            </label>
            <Pecha.Input
              id="delete-group-confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={groupTitle}
              autoComplete="off"
              disabled={deleteMutation.isPending}
            />
          </div>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("studio.common.cancel")}
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending || !nameMatches}
              onClick={(e) => {
                e.preventDefault();
                if (!nameMatches) return;
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending
                ? t("studio.common.deleting")
                : t("studio.common.delete")}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </>
  );
};

export default GroupLayout;
