import { useState } from "react";
import { IoMdAdd } from "react-icons/io";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/atoms/button";
import AuthButton from "@/components/ui/molecules/auth-button/AuthButton";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo } from "@/hooks/useUserInfo";
import { shouldShowCmsActionsColumn } from "@/lib/platformAccess";
import {
  createPrayerIntention,
  fetchPrayerIntentions,
  patchPrayerIntention,
  type CreatePrayerIntentionPayload,
  type PatchPrayerIntentionPayload,
  type PrayerIntention,
} from "./api/prayerIntentionsApi";
import PrayerIntentionsTable from "./PrayerIntentionsTable";
import PrayerIntentionFormDialog from "./PrayerIntentionFormDialog";

const PrayerIntentionsPage = () => {
  const { data: userInfo } = useUserInfo();
  const showActionsColumn =
    !!userInfo && shouldShowCmsActionsColumn(userInfo.platform_role);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PrayerIntention | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["cms-prayer-intentions"],
    queryFn: fetchPrayerIntentions,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-prayer-intentions"] });
  };

  const createMutation = useMutation({
    mutationFn: createPrayerIntention,
    onSuccess: () => {
      toast.success("Prayer intention created");
      setFormOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: PatchPrayerIntentionPayload;
    }) => patchPrayerIntention(id, payload),
    onSuccess: () => {
      toast.success("Prayer intention updated");
      setFormOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleOpenCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (intention: PrayerIntention) => {
    setEditing(intention);
    setFormOpen(true);
  };

  const handleSubmit = (
    payload: CreatePrayerIntentionPayload | PatchPrayerIntentionPayload,
  ) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload as CreatePrayerIntentionPayload);
    }
  };

  const intentions = data?.intentions ?? [];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Prayer intentions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catalog used for event prayer requests. Events can restrict which
            intentions appear in the picker.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showActionsColumn ? (
            <Button type="button" onClick={handleOpenCreate}>
              <IoMdAdd className="mr-1 h-4 w-4" />
              Add intention
            </Button>
          ) : null}
          <AuthButton />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
      ) : null}

      <PrayerIntentionsTable
        intentions={intentions}
        isLoading={isLoading}
        showActionsColumn={showActionsColumn}
        onEdit={handleOpenEdit}
      />

      <PrayerIntentionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        intention={editing}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default PrayerIntentionsPage;
