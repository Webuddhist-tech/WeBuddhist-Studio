import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { MdOutlineFileUpload } from "react-icons/md";
import { IoEyeOffSharp } from "react-icons/io5";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  isGroupVisibleInApp,
  pickGroupTitle,
  updateGroupStatus,
  type AuthorGroupDetailDTO,
} from "../api/groupsApi";

type GroupPublishControlProps = {
  group: AuthorGroupDetailDTO;
  variant?: "outline" | "default";
  size?: "sm" | "default";
  className?: string;
};

/** Sends PUBLISHED or UNPUBLISHED only; DRAFT stays the created state. */
const GroupPublishControl = ({
  group,
  variant = "outline",
  size = "sm",
  className,
}: GroupPublishControlProps) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isPublished = isGroupVisibleInApp(group.status);
  const groupTitle = pickGroupTitle(group.metadata);
  const memberCount = group.member_count ?? group.members?.length ?? 0;

  const statusMutation = useMutation({
    mutationFn: (status: "PUBLISHED" | "UNPUBLISHED") =>
      updateGroupStatus(group.id, status),
    onSuccess: (updated) => {
      // PATCH returns the full detail DTO, but merge rather than replace so a
      // partial response can never strip fields the detail pages dereference.
      queryClient.setQueryData<AuthorGroupDetailDTO>(
        ["cms-group", group.id],
        (previous) => (previous ? { ...previous, ...updated } : updated),
      );
      queryClient.invalidateQueries({ queryKey: ["cms-groups"] });
      setConfirmOpen(false);
      toast.success(
        isGroupVisibleInApp(updated.status)
          ? t("studio.groups.components.publish.published_toast")
          : t("studio.groups.components.publish.hidden_toast"),
      );
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleClick = () => {
    if (isPublished) {
      setConfirmOpen(true);
      return;
    }
    statusMutation.mutate("PUBLISHED");
  };

  // Without a status there is no current state to act on, so offer no action
  // rather than guessing — matches the badge and draft banner.
  if (!group.status) return null;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={statusMutation.isPending}
      >
        {isPublished ? (
          <>
            <IoEyeOffSharp className="w-4 h-4" />{" "}
            {t("studio.groups.components.publish.hide_from_app")}
          </>
        ) : (
          <>
            <MdOutlineFileUpload className="w-4 h-4" />
            {statusMutation.isPending
              ? t("studio.groups.components.publish.publishing")
              : t("studio.common.publish")}
          </>
        )}
      </Button>

      <Pecha.AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t("studio.groups.components.publish.confirm_title", {
                title: groupTitle,
              })}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {memberCount === 0
                    ? t("studio.groups.components.publish.confirm_body")
                    : memberCount === 1
                      ? t(
                          "studio.groups.components.publish.confirm_body_members_one",
                        )
                      : t(
                          "studio.groups.components.publish.confirm_body_members_other",
                          { count: memberCount },
                        )}
                </p>
                <p>
                  {t(
                    "studio.groups.components.publish.confirm_nothing_deleted",
                  )}
                </p>
              </div>
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel disabled={statusMutation.isPending}>
              {t("studio.common.cancel")}
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              disabled={statusMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                statusMutation.mutate("UNPUBLISHED");
              }}
            >
              {statusMutation.isPending
                ? t("studio.groups.components.publish.hiding")
                : t("studio.groups.components.publish.hide_group")}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </>
  );
};

export default GroupPublishControl;
