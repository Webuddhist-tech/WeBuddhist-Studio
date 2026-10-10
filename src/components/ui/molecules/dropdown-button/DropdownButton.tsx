import { useState } from "react";
import { Pecha } from "@/components/ui/shadimport";
import { FaPen } from "react-icons/fa";
import { BsThreeDotsVertical } from "react-icons/bs";
import { IoMdTrash, IoMdArchive } from "react-icons/io";
import { MdOutlineFileUpload } from "react-icons/md";
import { IoEyeOffSharp } from "react-icons/io5";
import { RiDraftLine } from "react-icons/ri";
import { MdSwapHoriz } from "react-icons/md";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/routes/paths";
import PlanDeleteDialog from "@/components/ui/molecules/modals/plan-delete/PlanDeleteDialog";
import ContentTransferDialog from "@/components/routes/content-transfer/components/ContentTransferDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/config/axios-config";
import { STATUS_TRANSITIONS, ALLOWED_TRANSITIONS } from "@/lib/constant";
import { normalizeStatus } from "@/components/routes/dashboard/dashboardTable";
import type { AuthorGroupMemberRole } from "@/components/routes/groups/api/groupsApi";
import type { PlatformRole } from "@/lib/platformAccess";
import {
  canChangeContentStatus,
  canDeleteContent,
  canEditContent,
  canInitiateContentTransfer,
} from "@/lib/contentPermissions";

export type DropdownAdditionalMenuItem = {
  label: string;
  onClick: () => void;
};

/** Menu labels for the status transitions, keyed by the backend value. */
const STATUS_TRANSITION_LABEL_KEYS: Record<string, string> = {
  DRAFT: "studio.common.draft",
  PUBLISHED: "studio.common.publish",
  UNPUBLISHED: "studio.common.unpublish",
  ARCHIVED: "studio.shell.content_actions.archive",
};

/** Names of the resulting statuses, keyed by the backend value. */
const STATUS_NAME_KEYS: Record<string, string> = {
  DRAFT: "studio.common.draft",
  PUBLISHED: "studio.common.published",
  UNPUBLISHED: "studio.shell.content_actions.status_unpublished",
  ARCHIVED: "studio.shell.content_actions.status_archived",
};

const STATUS_ICONS = {
  PUBLISHED: MdOutlineFileUpload,
  UNPUBLISHED: IoEyeOffSharp,
  ARCHIVED: IoMdArchive,
  DRAFT: RiDraftLine,
};

export type DropdownButtonEntityType = "plan" | "series";

export function DropdownButton({
  id,
  currentStatus,
  triggerVariant = "default",
  triggerClassName,
  entityType = "plan",
  additionalMenuItems,
  invalidateSeriesId,
  readOnly = false,
  groupRole,
  platformRole,
  sourceGroupId,
  contentTitle,
}: {
  id: string;
  currentStatus: string;
  triggerVariant?: "default" | "icon";
  triggerClassName?: string;
  entityType?: DropdownButtonEntityType;
  additionalMenuItems?: DropdownAdditionalMenuItem[];
  /** When plan actions run on series details, refresh that series query too. */
  invalidateSeriesId?: string;
  readOnly?: boolean;
  groupRole?: AuthorGroupMemberRole;
  platformRole?: PlatformRole;
  /** Current owning group; required to show transfer action. */
  sourceGroupId?: string | null;
  contentTitle?: string;
}) {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const [transferOpen, setTransferOpen] = useState(false);
  const isSeries = entityType === "series";
  const apiBase = isSeries ? "/api/v1/cms/series" : "/api/v1/cms/plans";
  const editHref = isSeries ? ROUTES.seriesEdit(id) : ROUTES.planEdit(id);
  const editLabel = isSeries
    ? t("studio.shell.content_actions.edit_series")
    : t("studio.shell.content_actions.edit_plan");
  const deleteLabel = isSeries
    ? t("studio.modals.delete_series")
    : t("studio.modals.delete_plan");

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axiosInstance.delete(`${apiBase}/${id}`);
      return data;
    },
    onSuccess: () => {
      toast.success(
        isSeries
          ? t("studio.shell.content_actions.series_deleted")
          : t("studio.shell.content_actions.plan_deleted"),
        {
          description: isSeries
            ? t("studio.shell.content_actions.series_deleted_description")
            : t("studio.shell.content_actions.plan_deleted_description"),
        },
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard-items"] });
      if (invalidateSeriesId) {
        queryClient.invalidateQueries({
          queryKey: ["series", invalidateSeriesId],
        });
      }
    },
    onError: (error: {
      response?: { data?: { detail?: { message?: string } } };
    }) => {
      toast.error(
        isSeries
          ? t("studio.shell.content_actions.series_delete_failed")
          : t("studio.shell.content_actions.plan_delete_failed"),
        {
          description: error.response?.data?.detail?.message,
        },
      );
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate(id);
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await axiosInstance.patch(`${apiBase}/${id}/status`, {
        status: newStatus,
      });

      toast.success(
        t("studio.shell.content_actions.status_updated", {
          status: STATUS_NAME_KEYS[newStatus]
            ? t(STATUS_NAME_KEYS[newStatus])
            : newStatus,
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard-items"] });
      if (isSeries) {
        queryClient.invalidateQueries({ queryKey: ["series", id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["planDetails", id] });
        if (invalidateSeriesId) {
          queryClient.invalidateQueries({
            queryKey: ["series", invalidateSeriesId],
          });
        }
      }
    } catch (error: unknown) {
      const message = (
        error as { response?: { data?: { detail?: { message?: string } } } }
      )?.response?.data?.detail?.message;
      toast.error(
        message ?? t("studio.shell.content_actions.status_update_failed"),
      );
    }
  };

  const status = normalizeStatus(
    currentStatus,
  ) as keyof typeof ALLOWED_TRANSITIONS;
  const allowedStatuses = ALLOWED_TRANSITIONS[status] ?? [];
  const availableTransitions = STATUS_TRANSITIONS.filter((statusOption) =>
    allowedStatuses.includes(statusOption.value),
  );

  const extraItems = additionalMenuItems ?? [];
  const allowEdit =
    !readOnly && canEditContent(groupRole, status, platformRole);
  const allowDelete =
    !readOnly && canDeleteContent(groupRole, status, platformRole);
  const allowStatus =
    !readOnly && canChangeContentStatus(groupRole, platformRole);
  const allowTransfer =
    !readOnly &&
    Boolean(sourceGroupId) &&
    canInitiateContentTransfer(groupRole, platformRole);

  const invalidateAfterTransfer = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-items"] });
    queryClient.invalidateQueries({ queryKey: ["transfer-requests"] });
    if (isSeries) {
      queryClient.invalidateQueries({ queryKey: ["series", id] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["planDetails", id] });
      if (invalidateSeriesId) {
        queryClient.invalidateQueries({
          queryKey: ["series", invalidateSeriesId],
        });
      }
    }
  };

  if (readOnly) {
    return (
      <span className="text-xs text-muted-foreground" aria-hidden>
        —
      </span>
    );
  }

  const hasMenuItems =
    allowEdit ||
    allowDelete ||
    allowStatus ||
    allowTransfer ||
    extraItems.length > 0;

  if (!hasMenuItems) {
    return (
      <span className="text-xs text-muted-foreground" aria-hidden>
        —
      </span>
    );
  }

  return (
    <Pecha.ButtonGroup className="mx-auto">
      <Pecha.DropdownMenu>
        <Pecha.DropdownMenuTrigger asChild>
          {triggerVariant === "icon" ? (
            <Pecha.Button
              variant="outline"
              size="icon"
              className={triggerClassName}
              aria-label={
                isSeries
                  ? t("studio.shell.content_actions.series_actions")
                  : t("studio.shell.content_actions.plan_actions")
              }
            >
              <BsThreeDotsVertical className="h-4 w-4" />
            </Pecha.Button>
          ) : (
            <Pecha.Button variant="outline">
              {t("studio.common.status")} <BsThreeDotsVertical />
            </Pecha.Button>
          )}
        </Pecha.DropdownMenuTrigger>
        <Pecha.DropdownMenuContent align="end" className="[--radius:1rem]">
          {allowEdit ? (
            <Pecha.DropdownMenuGroup>
              <Link to={editHref}>
                <Pecha.DropdownMenuItem>
                  <FaPen className="h-4 w-4" />
                  {editLabel}
                </Pecha.DropdownMenuItem>
              </Link>
            </Pecha.DropdownMenuGroup>
          ) : null}
          {allowStatus ? (
            <>
              <Pecha.DropdownMenuSeparator />
              <Pecha.DropdownMenuItem disabled>
                {t("studio.common.status")}
              </Pecha.DropdownMenuItem>
              <Pecha.DropdownMenuGroup>
                {availableTransitions.map((status) => {
                  const IconComponent =
                    STATUS_ICONS[status.value as keyof typeof STATUS_ICONS];
                  return (
                    <Pecha.DropdownMenuItem
                      key={status.value}
                      onClick={() => handleStatusChange(status.value)}
                    >
                      <IconComponent className="h-4 w-4" />
                      {STATUS_TRANSITION_LABEL_KEYS[status.value]
                        ? t(STATUS_TRANSITION_LABEL_KEYS[status.value])
                        : status.label}
                    </Pecha.DropdownMenuItem>
                  );
                })}
              </Pecha.DropdownMenuGroup>
            </>
          ) : null}
          {allowTransfer && sourceGroupId ? (
            <>
              <Pecha.DropdownMenuSeparator />
              <Pecha.DropdownMenuGroup>
                <Pecha.DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setTransferOpen(true);
                  }}
                >
                  <MdSwapHoriz className="h-4 w-4" />
                  {t("studio.shell.content_actions.transfer_to_group")}
                </Pecha.DropdownMenuItem>
              </Pecha.DropdownMenuGroup>
            </>
          ) : null}
          {extraItems.length > 0 && (
            <>
              <Pecha.DropdownMenuSeparator />
              <Pecha.DropdownMenuGroup>
                {extraItems.map((item) => (
                  <Pecha.DropdownMenuItem
                    key={item.label}
                    onClick={item.onClick}
                  >
                    {item.label}
                  </Pecha.DropdownMenuItem>
                ))}
              </Pecha.DropdownMenuGroup>
            </>
          )}
          {allowDelete && (
            <>
              <Pecha.DropdownMenuSeparator />
              <Pecha.DropdownMenuGroup>
                <PlanDeleteDialog
                  id={id}
                  entityType={entityType}
                  onDelete={handleDelete}
                  trigger={
                    <Pecha.DropdownMenuItem
                      variant="destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                      }}
                    >
                      <span className="flex w-full items-center gap-2">
                        <IoMdTrash className="h-4 w-4" />
                        {deleteLabel}
                      </span>
                    </Pecha.DropdownMenuItem>
                  }
                />
              </Pecha.DropdownMenuGroup>
            </>
          )}
        </Pecha.DropdownMenuContent>
      </Pecha.DropdownMenu>
      {allowTransfer && sourceGroupId ? (
        <ContentTransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          contentType={entityType}
          contentId={id}
          sourceGroupId={sourceGroupId}
          contentTitle={contentTitle}
          onSuccess={invalidateAfterTransfer}
        />
      ) : null}
    </Pecha.ButtonGroup>
  );
}
