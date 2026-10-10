import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Dropzone from "react-dropzone";
import { useDebounce } from "use-debounce";
import {
  FiCheck,
  FiEdit2,
  FiLoader,
  FiSearch,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { FaTrash } from "react-icons/fa6";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";

import { Pecha } from "@/components/ui/shadimport";
import AuthButton from "@/components/ui/molecules/auth-button/AuthButton";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { formatMs, getAudioDurationMs } from "@/lib/utils";
import { tolgee } from "@/i18n/tolgee";

import {
  deleteRecording,
  fetchEditionRecordings,
  personLabel,
  renameRecording,
  searchPersons,
  searchTexts,
  type ContributorRole,
  type Person,
  type Recording,
  type TextSearchResult,
  uploadRecording,
} from "./api/textAudioApi";

const recordingLabel = (recording: Recording) =>
  recording.title?.en ??
  tolgee.t("studio.text_audio.recording_fallback", {
    format: recording.format,
  });

const CONTRIBUTOR_ROLES: ContributorRole[] = [
  "narrator",
  "translator",
  "author",
  "reviser",
  "scholar",
];

const TextAudioPage = () => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search.trim(), 400);
  const [selectedText, setSelectedText] = useState<TextSearchResult | null>(
    null,
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingToDelete, setRecordingToDelete] = useState<Recording | null>(
    null,
  );
  const [editingRecordingId, setEditingRecordingId] = useState<string | null>(
    null,
  );
  const [editingName, setEditingName] = useState("");
  const [contributorQuery, setContributorQuery] = useState("");
  const [debouncedContributorQuery] = useDebounce(contributorQuery.trim(), 400);
  const [isContributorOpen, setIsContributorOpen] = useState(false);
  const [selectedContributor, setSelectedContributor] = useState<Person | null>(
    null,
  );
  const [contributorRole, setContributorRole] =
    useState<ContributorRole>("narrator");

  const textsQuery = useQuery({
    queryKey: ["text-audio-texts", debouncedSearch],
    queryFn: () => searchTexts(debouncedSearch),
    retry: false,
  });

  const personsQuery = useQuery({
    queryKey: ["text-audio-persons", debouncedContributorQuery],
    queryFn: () => searchPersons(debouncedContributorQuery),
    enabled: isContributorOpen,
    retry: false,
  });

  const recordingsQuery = useQuery({
    queryKey: ["edition-recordings", selectedText?.id],
    queryFn: () => fetchEditionRecordings(selectedText!.id),
    enabled: Boolean(selectedText),
    retry: false,
  });

  const recordings = recordingsQuery.data ?? [];

  // Every mutation below can still be in flight when the user selects a
  // different text, and TanStack Query re-binds onSuccess/onError to the
  // component's latest render before invoking them - so reading
  // selectedText there would see whatever the user has navigated to *since*,
  // not the text the request was actually made for. Each mutation instead
  // takes its edition id as a variable, captured synchronously at the moment
  // it's fired, and completions use that captured id both for cache
  // invalidation and to decide whether it's still safe to touch selection
  // state.
  const uploadMutation = useMutation({
    mutationFn: async ({
      text,
      file,
      contributor,
      role,
    }: {
      text: TextSearchResult;
      file: File;
      contributor: Person;
      role: ContributorRole;
    }) => {
      // The browser can't decode every valid audio codec (e.g. ALAC m4a
      // from iOS/Mac Voice Memos), and the upload shouldn't be blocked by a
      // failed local probe - duration just ends up unset.
      const durationMs = await getAudioDurationMs(file).catch(() => undefined);
      return uploadRecording({
        edition: text,
        file,
        durationMs,
        contribution: {
          type: "person",
          id: contributor.id,
          bdrc_id: contributor.bdrc_id,
          role,
        },
        onProgress: setUploadProgress,
      });
    },
    onSuccess: (_recording, { text }) => {
      queryClient.invalidateQueries({
        queryKey: ["edition-recordings", text.id],
      });
      if (selectedText?.id === text.id) {
        setPendingFile(null);
        setUploadProgress(0);
      }
      toast.success(t("studio.text_audio.toast_uploaded"));
    },
    onError: (error) => {
      setUploadProgress(0);
      toast.error(t("studio.text_audio.toast_upload_failed"), {
        description: getApiErrorMessage(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ recording }: { editionId: string; recording: Recording }) =>
      deleteRecording(recording.id),
    onSuccess: (_, { editionId }) => {
      queryClient.invalidateQueries({
        queryKey: ["edition-recordings", editionId],
      });
      setRecordingToDelete(null);
      toast.success(t("studio.text_audio.toast_deleted"));
    },
    onError: (error) =>
      toast.error(t("studio.text_audio.toast_delete_failed"), {
        description: getApiErrorMessage(error),
      }),
  });

  const renameMutation = useMutation({
    mutationFn: ({
      recording,
      name,
    }: {
      editionId: string;
      recording: Recording;
      name: string;
    }) => renameRecording(recording.id, name),
    onSuccess: (_, { editionId }) => {
      queryClient.invalidateQueries({
        queryKey: ["edition-recordings", editionId],
      });
      setEditingRecordingId(null);
      toast.success(t("studio.text_audio.toast_renamed"));
    },
    onError: (error) =>
      toast.error(t("studio.text_audio.toast_rename_failed"), {
        description: getApiErrorMessage(error),
      }),
  });

  const selectText = (text: TextSearchResult) => {
    setSelectedText(text);
    setPendingFile(null);
    setUploadProgress(0);
  };

  const startRename = (recording: Recording) => {
    setEditingRecordingId(recording.id);
    setEditingName(recordingLabel(recording));
  };

  const cancelRename = () => {
    setEditingRecordingId(null);
    setEditingName("");
  };

  const saveRename = (recording: Recording) => {
    const name = editingName.trim();
    if (!name || name === recordingLabel(recording)) {
      cancelRename();
      return;
    }
    renameMutation.mutate({ editionId: selectedText!.id, recording, name });
  };

  const isUploading = uploadMutation.isPending;

  return (
    <div className="flex flex-col border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl font-dynamic max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="px-4 pt-10 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {t("studio.text_audio.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("studio.text_audio.subtitle")}
          </p>
        </div>
        <AuthButton />
      </div>
      <div className="border-b border-dashed border-gray-300 dark:border-input" />

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(280px,2fr)_3fr]">
        <section className="rounded-lg border bg-white dark:bg-[#161616] p-4">
          <label className="text-sm font-medium" htmlFor="text-audio-search">
            {t("studio.text_audio.search_label")}
          </label>
          <div className="mt-2 flex items-center rounded-md border px-3">
            <FiSearch className="shrink-0 text-muted-foreground" />
            <Pecha.Input
              id="text-audio-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("studio.text_audio.search_placeholder")}
              className="border-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="mt-3 max-h-[calc(100vh-230px)] space-y-1 overflow-auto">
            {textsQuery.isFetching ? (
              <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <FiLoader className="animate-spin" />{" "}
                {t("studio.common.loading")}
              </p>
            ) : textsQuery.isError ? (
              <p className="p-3 text-sm text-red-500">
                {getApiErrorMessage(textsQuery.error)}
              </p>
            ) : textsQuery.data?.length ? (
              textsQuery.data.map((text) => (
                <button
                  key={text.id}
                  type="button"
                  onClick={() => selectText(text)}
                  className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${
                    selectedText?.id === text.id
                      ? "border-[#A51C21] bg-[#A51C21]/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="font-medium">{text.title}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {text.id}
                  </span>
                </button>
              ))
            ) : (
              <p className="p-3 text-sm text-muted-foreground">
                {t("studio.text_audio.no_texts")}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-white dark:bg-[#161616] p-5">
          {!selectedText ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
              {t("studio.text_audio.select_text")}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">{selectedText.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {selectedText.id}
                </p>
              </div>

              {recordingsQuery.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FiLoader className="animate-spin" />{" "}
                  {t("studio.text_audio.loading_audios")}
                </p>
              ) : recordingsQuery.isError ? (
                <p className="text-sm text-red-500">
                  {getApiErrorMessage(recordingsQuery.error)}
                </p>
              ) : recordings.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {t("studio.text_audio.audios_count", {
                      count: recordings.length,
                    })}
                  </p>
                  {recordings.map((recording) => (
                    <div
                      key={recording.id}
                      className="space-y-2 rounded-lg border p-3"
                    >
                      {editingRecordingId === recording.id ? (
                        <div className="flex items-center gap-1">
                          <Pecha.Input
                            autoFocus
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") saveRename(recording);
                              if (event.key === "Escape") cancelRename();
                            }}
                            className="h-8"
                          />
                          <Pecha.Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={renameMutation.isPending}
                            onClick={() => saveRename(recording)}
                          >
                            <FiCheck />
                          </Pecha.Button>
                          <Pecha.Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={renameMutation.isPending}
                            onClick={cancelRename}
                          >
                            <FiX />
                          </Pecha.Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium">
                            {recordingLabel(recording)}
                          </span>
                          <button
                            type="button"
                            aria-label={t("studio.text_audio.rename_aria")}
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => startRename(recording)}
                          >
                            <FiEdit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <audio
                        key={recording.audio_url}
                        controls
                        preload="metadata"
                        src={recording.audio_url}
                        className="w-full"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{recording.format.toUpperCase()}</span>
                        <div className="flex items-center gap-3">
                          <span>
                            {recording.duration_ms != null
                              ? formatMs(recording.duration_ms)
                              : t("studio.text_audio.duration_unavailable")}
                          </span>
                          <Pecha.Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => setRecordingToDelete(recording)}
                          >
                            <FaTrash />
                          </Pecha.Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {t("studio.text_audio.no_audio")}
                </p>
              )}

              <div className="space-y-3">
                <Dropzone
                  accept={{
                    "audio/*": [".mp3", ".m4a", ".wav", ".aac", ".ogg"],
                  }}
                  multiple={false}
                  disabled={isUploading}
                  onDrop={(files) => setPendingFile(files[0] ?? null)}
                >
                  {({ getRootProps, getInputProps }) => (
                    <div
                      {...getRootProps()}
                      className="cursor-pointer rounded-lg border border-dashed p-8 text-center hover:bg-muted/50"
                    >
                      <input {...getInputProps()} />
                      <FiUpload className="mx-auto mb-2 h-6 w-6" />
                      <p className="text-sm font-medium">
                        {pendingFile
                          ? pendingFile.name
                          : t("studio.ambient_sounds.form.add_audio_file")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("studio.ambient_sounds.form.audio_hint")}
                      </p>
                    </div>
                  )}
                </Dropzone>

                {isUploading ? (
                  <div
                    aria-label={t("studio.text_audio.upload_progress_aria", {
                      progress: uploadProgress,
                    })}
                  >
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-[#A51C21] transition-[width]"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-right text-xs text-muted-foreground">
                      {t("studio.text_audio.uploading_progress", {
                        progress: uploadProgress,
                      })}
                    </p>
                  </div>
                ) : null}

                {pendingFile ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <div className="min-w-52 flex-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          {t("studio.text_audio.contributor")}
                        </label>
                        <Pecha.Popover
                          open={isContributorOpen}
                          onOpenChange={setIsContributorOpen}
                        >
                          <Pecha.PopoverTrigger asChild>
                            <Pecha.Button
                              type="button"
                              variant="outline"
                              className="mt-1 w-full justify-start font-normal"
                              disabled={isUploading}
                            >
                              {selectedContributor
                                ? personLabel(selectedContributor)
                                : t("studio.text_audio.search_person")}
                            </Pecha.Button>
                          </Pecha.PopoverTrigger>
                          <Pecha.PopoverContent
                            className="w-[--radix-popover-trigger-width] p-0"
                            align="start"
                          >
                            <Pecha.Command shouldFilter={false}>
                              <Pecha.CommandInput
                                placeholder={t(
                                  "studio.text_audio.search_persons",
                                )}
                                value={contributorQuery}
                                onValueChange={setContributorQuery}
                              />
                              <Pecha.CommandList>
                                {personsQuery.isFetching ? (
                                  <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                                    <FiLoader className="animate-spin" />{" "}
                                    {t("studio.common.loading")}
                                  </p>
                                ) : (
                                  <Pecha.CommandGroup>
                                    {(personsQuery.data ?? []).map((person) => (
                                      <Pecha.CommandItem
                                        key={person.id}
                                        value={person.id}
                                        onSelect={() => {
                                          setSelectedContributor(person);
                                          setIsContributorOpen(false);
                                        }}
                                      >
                                        {personLabel(person)}
                                      </Pecha.CommandItem>
                                    ))}
                                  </Pecha.CommandGroup>
                                )}
                                {!personsQuery.isFetching &&
                                  personsQuery.data?.length === 0 && (
                                    <Pecha.CommandEmpty>
                                      {t("studio.text_audio.no_persons")}
                                    </Pecha.CommandEmpty>
                                  )}
                              </Pecha.CommandList>
                            </Pecha.Command>
                          </Pecha.PopoverContent>
                        </Pecha.Popover>
                      </div>
                      <div className="w-40">
                        <label className="text-xs font-medium text-muted-foreground">
                          {t("studio.text_audio.role")}
                        </label>
                        <Pecha.Select
                          value={contributorRole}
                          onValueChange={(value) =>
                            setContributorRole(value as ContributorRole)
                          }
                          disabled={isUploading}
                        >
                          <Pecha.SelectTrigger className="mt-1">
                            <Pecha.SelectValue />
                          </Pecha.SelectTrigger>
                          <Pecha.SelectContent>
                            {CONTRIBUTOR_ROLES.map((role) => (
                              <Pecha.SelectItem key={role} value={role}>
                                {t(`studio.text_audio.roles.${role}`)}
                              </Pecha.SelectItem>
                            ))}
                          </Pecha.SelectContent>
                        </Pecha.Select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Pecha.Button
                        type="button"
                        className="bg-[#A51C21] hover:bg-[#A51C21]/90"
                        disabled={isUploading || !selectedContributor}
                        onClick={() =>
                          selectedContributor &&
                          uploadMutation.mutate({
                            text: selectedText,
                            file: pendingFile,
                            contributor: selectedContributor,
                            role: contributorRole,
                          })
                        }
                      >
                        {isUploading ? (
                          <FiLoader className="animate-spin" />
                        ) : (
                          <FiUpload />
                        )}
                        {t("studio.text_audio.upload_audio")}
                      </Pecha.Button>
                      <Pecha.Button
                        type="button"
                        variant="outline"
                        disabled={isUploading}
                        onClick={() => setPendingFile(null)}
                      >
                        {t("studio.common.cancel")}
                      </Pecha.Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>

      <Pecha.AlertDialog
        open={Boolean(recordingToDelete)}
        onOpenChange={(open) => {
          if (!open) setRecordingToDelete(null);
        }}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t("studio.text_audio.delete_title")}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {t("studio.text_audio.delete_description", {
                name: recordingToDelete
                  ? recordingLabel(recordingToDelete)
                  : "",
              })}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel>
              {t("studio.common.cancel")}
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={() =>
                recordingToDelete &&
                selectedText &&
                deleteMutation.mutate({
                  editionId: selectedText.id,
                  recording: recordingToDelete,
                })
              }
            >
              {deleteMutation.isPending
                ? t("studio.common.deleting")
                : t("studio.common.delete")}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default TextAudioPage;
