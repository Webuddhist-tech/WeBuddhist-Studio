import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { IoMdAttach, IoMdClose } from "react-icons/io";
import { LuFilePlus2 } from "react-icons/lu";
import { Pecha } from "@/components/ui/shadimport";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  TEXT_REQUEST_ACCEPTED_EXTENSIONS,
  TEXT_REQUEST_MAX_FILES,
  TEXT_REQUEST_MAX_TOTAL_MB,
  createTextRequest,
  fetchMyTextRequests,
  formatFileSize,
  authorDisplayName,
} from "./api/textRequestsApi";
import { TextRequestStatusBadge } from "./TextRequestStatusBadge";
import { TextRequestAttachmentList } from "./TextRequestAttachmentList";

const MAX_MESSAGE_LENGTH = 4000;
const MY_REQUESTS_QUERY_KEY = ["my-text-requests"];

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
};

interface RequestTextsDialogProps {
  /** The space the request is made from; sent along as context. */
  groupId?: string | null;
  /** The chant collection being built, when there is one yet. */
  collectionId?: string | null;
  size?: "sm" | "default";
}

/**
 * Lets an author ask for chants the library does not have yet: a message and
 * any files (documents, zips, scans) to work from. Content admins answer it
 * from Administration > Text requests; the "My requests" tab shows the reply.
 */
export const RequestTextsDialog = ({
  groupId,
  collectionId,
  size = "sm",
}: RequestTextsDialogProps) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "mine">("new");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const myRequestsQuery = useQuery({
    queryKey: MY_REQUESTS_QUERY_KEY,
    queryFn: () => fetchMyTextRequests({ limit: 50 }),
    enabled: open && tab === "mine",
  });

  const reset = () => {
    setMessage("");
    setFiles([]);
  };

  const mutation = useMutation({
    mutationFn: () =>
      createTextRequest({
        message: message.trim(),
        files,
        groupId,
        collectionId,
      }),
    onSuccess: () => {
      toast.success(t("studio.text_requests.request.sent"));
      queryClient.invalidateQueries({ queryKey: MY_REQUESTS_QUERY_KEY });
      reset();
      setTab("mine");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const overSize = totalBytes > TEXT_REQUEST_MAX_TOTAL_MB * 1024 * 1024;

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    const accepted: File[] = [];
    for (const file of Array.from(picked)) {
      if (
        !(TEXT_REQUEST_ACCEPTED_EXTENSIONS as readonly string[]).includes(
          extensionOf(file.name),
        )
      ) {
        toast.error(
          t("studio.text_requests.request.unsupported_file", {
            name: file.name,
          }),
        );
        continue;
      }
      accepted.push(file);
    }
    setFiles((current) => {
      const next = [...current, ...accepted];
      if (next.length > TEXT_REQUEST_MAX_FILES) {
        toast.error(
          t("studio.text_requests.request.too_many_files", {
            count: TEXT_REQUEST_MAX_FILES,
          }),
        );
        return next.slice(0, TEXT_REQUEST_MAX_FILES);
      }
      return next;
    });
    // Picking the same file again after removing it must still fire onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canSubmit =
    message.trim().length > 0 &&
    message.length <= MAX_MESSAGE_LENGTH &&
    !overSize &&
    !mutation.isPending;

  const renderMyRequests = () => {
    if (myRequestsQuery.isLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Pecha.Skeleton key={index} className="h-20 w-full rounded-md" />
          ))}
        </div>
      );
    }
    if (myRequestsQuery.isError) {
      return (
        <p className="py-6 text-center text-sm text-destructive">
          {getApiErrorMessage(myRequestsQuery.error)}
        </p>
      );
    }
    const requests = myRequestsQuery.data?.requests ?? [];
    if (requests.length === 0) {
      return (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("studio.text_requests.request.none_yet")}
        </p>
      );
    }
    return (
      <div className="space-y-3">
        {requests.map((request) => (
          <div key={request.id} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {format(new Date(request.created_at), "MMM dd, yyyy HH:mm")}
                {request.group_name ? ` · ${request.group_name}` : ""}
              </span>
              <TextRequestStatusBadge status={request.status} />
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">
              {request.message}
            </p>
            <TextRequestAttachmentList attachments={request.attachments} />
            {request.reply || request.text_id ? (
              <div className="space-y-1 rounded-md bg-muted/60 p-2 text-sm">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("studio.text_requests.reply_from", {
                    name:
                      authorDisplayName(request.responder) ??
                      t("studio.text_requests.admin"),
                  })}
                </p>
                {request.reply ? (
                  <p className="whitespace-pre-wrap break-words">
                    {request.reply}
                  </p>
                ) : null}
                {request.text_id ? (
                  <p className="text-xs">
                    {t("studio.text_requests.linked_text")}{" "}
                    <code className="break-all">{request.text_id}</code>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Pecha.Button
        type="button"
        variant="outline"
        size={size}
        onClick={() => {
          setTab("new");
          setOpen(true);
        }}
      >
        <LuFilePlus2 className="h-4 w-4" />
        {t("studio.text_requests.request.button")}
      </Pecha.Button>

      <Pecha.Dialog
        open={open}
        onOpenChange={(next) => {
          // Closing mid-upload would drop the result; let it finish.
          if (!next && mutation.isPending) return;
          setOpen(next);
        }}
      >
        <Pecha.DialogContent className="flex max-h-[90vh] flex-col sm:max-w-xl">
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>
              {t("studio.text_requests.request.title")}
            </Pecha.DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("studio.text_requests.request.description")}
            </p>
          </Pecha.DialogHeader>

          <Pecha.Tabs
            value={tab}
            onValueChange={(value) => setTab(value as "new" | "mine")}
            className="flex min-h-0 flex-1 flex-col"
          >
            <Pecha.TabsList>
              <Pecha.TabsTrigger value="new">
                {t("studio.text_requests.request.tab_new")}
              </Pecha.TabsTrigger>
              <Pecha.TabsTrigger value="mine">
                {t("studio.text_requests.request.tab_mine")}
              </Pecha.TabsTrigger>
            </Pecha.TabsList>

            <Pecha.TabsContent value="new" className="space-y-4 pt-2">
              <div className="space-y-2">
                <label
                  htmlFor="text-request-message"
                  className="text-sm font-medium"
                >
                  {t("studio.text_requests.request.message_label")}
                </label>
                <Pecha.Textarea
                  id="text-request-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t(
                    "studio.text_requests.request.message_placeholder",
                  )}
                  rows={5}
                  maxLength={MAX_MESSAGE_LENGTH}
                  disabled={mutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={TEXT_REQUEST_ACCEPTED_EXTENSIONS.join(",")}
                  className="hidden"
                  onChange={(event) => addFiles(event.target.files)}
                />
                <Pecha.Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={
                    mutation.isPending || files.length >= TEXT_REQUEST_MAX_FILES
                  }
                >
                  <IoMdAttach className="h-4 w-4" />
                  {t("studio.text_requests.request.attach_files")}
                </Pecha.Button>
                <p className="text-xs text-muted-foreground">
                  {t("studio.text_requests.request.attach_hint", {
                    count: TEXT_REQUEST_MAX_FILES,
                    mb: TEXT_REQUEST_MAX_TOTAL_MB,
                  })}
                </p>
                {files.length > 0 ? (
                  <ul className="space-y-1">
                    {files.map((file, index) => (
                      <li
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-2 rounded border px-2 py-1 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {file.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </span>
                        <button
                          type="button"
                          aria-label={t("studio.common.remove")}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={mutation.isPending}
                          onClick={() =>
                            setFiles((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <IoMdClose className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {overSize ? (
                  <p className="text-xs text-destructive">
                    {t("studio.text_requests.request.too_large", {
                      mb: TEXT_REQUEST_MAX_TOTAL_MB,
                    })}
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Pecha.Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={mutation.isPending}
                >
                  {t("studio.common.cancel")}
                </Pecha.Button>
                <Pecha.Button
                  type="button"
                  onClick={() => mutation.mutate()}
                  disabled={!canSubmit}
                  className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
                >
                  {mutation.isPending
                    ? t("studio.text_requests.request.sending")
                    : t("studio.text_requests.request.send")}
                </Pecha.Button>
              </div>
            </Pecha.TabsContent>

            <Pecha.TabsContent
              value="mine"
              className="min-h-0 flex-1 overflow-y-auto pt-2"
            >
              {renderMyRequests()}
            </Pecha.TabsContent>
          </Pecha.Tabs>
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </>
  );
};
