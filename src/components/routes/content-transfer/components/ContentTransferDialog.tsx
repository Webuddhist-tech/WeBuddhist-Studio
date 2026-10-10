import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  createPlanTransferRequest,
  createSeriesTransferRequest,
} from "../api/transferApi";
import {
  fetchGroupsForTransfer,
  pickGroupTitle,
  type AuthorGroupListItem,
} from "@/components/routes/groups/api/groupsApi";

type ContentTransferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: "plan" | "series";
  contentId: string;
  sourceGroupId: string;
  contentTitle?: string;
  onSuccess?: () => void;
};

const ContentTransferDialog = ({
  open,
  onOpenChange,
  contentType,
  contentId,
  sourceGroupId,
  contentTitle,
  onSuccess,
}: ContentTransferDialogProps) => {
  const { t } = useTranslate();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 400);
  const [groups, setGroups] = useState<AuthorGroupListItem[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedGroupId(null);
      setGroups([]);
      return;
    }

    let cancelled = false;
    setIsLoadingGroups(true);
    void fetchGroupsForTransfer({
      search: debouncedSearch || undefined,
      excludeGroupId: sourceGroupId,
    })
      .then((list) => {
        if (cancelled) return;
        setGroups(list);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingGroups(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, debouncedSearch, sourceGroupId]);

  const transferMutation = useMutation({
    mutationFn: (targetGroupId: string) =>
      contentType === "series"
        ? createSeriesTransferRequest(contentId, targetGroupId)
        : createPlanTransferRequest(contentId, targetGroupId),
    onSuccess: () => {
      toast.success(t("studio.content_transfer.toast.sent"), {
        description: t("studio.content_transfer.toast.sent_description"),
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const isSeries = contentType === "series";

  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      <Pecha.DialogContent className="max-w-md">
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>
            {isSeries
              ? t("studio.content_transfer.title_series")
              : t("studio.content_transfer.title_plan")}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>
        <p className="text-sm text-muted-foreground">
          {contentTitle
            ? t("studio.content_transfer.description_with_title", {
                title: contentTitle,
              })
            : isSeries
              ? t("studio.content_transfer.description_series")
              : t("studio.content_transfer.description_plan")}
        </p>

        <div className="space-y-3 py-2">
          <Pecha.Input
            placeholder={t("studio.content_transfer.search_groups")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="max-h-52 overflow-y-auto rounded-md border border-input">
            {isLoadingGroups ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {t("studio.content_transfer.loading_groups")}
              </p>
            ) : groups.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {t("studio.content_transfer.no_groups")}
              </p>
            ) : (
              <ul>
                {groups.map((group) => {
                  const title = pickGroupTitle(group.metadata);
                  const selected = selectedGroupId === group.id;
                  return (
                    <li key={group.id}>
                      <button
                        type="button"
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/60 ${
                          selected ? "bg-muted font-medium" : ""
                        }`}
                        onClick={() => setSelectedGroupId(group.id)}
                      >
                        {title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("studio.common.cancel")}
          </Button>
          <Button
            type="button"
            className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
            disabled={!selectedGroupId || transferMutation.isPending}
            onClick={() => {
              if (selectedGroupId) {
                transferMutation.mutate(selectedGroupId);
              }
            }}
          >
            {transferMutation.isPending
              ? t("studio.content_transfer.sending")
              : t("studio.content_transfer.send_request")}
          </Button>
        </div>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default ContentTransferDialog;
