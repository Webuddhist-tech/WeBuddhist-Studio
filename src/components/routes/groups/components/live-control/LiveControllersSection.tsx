import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuCopy, LuExternalLink, LuPlay, LuPlus } from "react-icons/lu";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { cn } from "@/lib/utils";
import {
  controllerLink,
  createController,
  fetchControllers,
  hasToken,
  liveControlKeys,
  revokeController,
  updateController,
  type LiveController,
  type LiveControllerWithToken,
  type PlanText,
} from "../../api/liveControlSettingsApi";

/** Shortest token an author may type; generated ones are longer. */
const MIN_TOKEN_LENGTH = 16;
const NO_DEFAULT_TEXT = "__none__";

interface ControllerDraft {
  id: string | null;
  name: string;
  ownToken: boolean;
  token: string;
  defaultTextId: string;
}

const emptyDraft: ControllerDraft = {
  id: null,
  name: "",
  ownToken: false,
  token: "",
  defaultTextId: NO_DEFAULT_TEXT,
};

const formatWhen = (iso: string | null, never: string) =>
  iso
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso))
    : never;

/** A long value on one line, cut short on screen, with a copy button at its end. */
const CopyField = ({
  label,
  value,
  copyLabel,
  onCopy,
}: {
  label: string;
  value: string;
  copyLabel: string;
  onCopy: () => void;
}) => (
  <div className="min-w-0 space-y-1">
    <span className="text-xs font-medium">{label}</span>
    <div className="flex min-w-0 items-center rounded-md border bg-muted/50">
      <code
        title={value}
        className="min-w-0 flex-1 truncate px-2 py-1.5 text-xs"
      >
        {value}
      </code>
      <button
        type="button"
        aria-label={copyLabel}
        title={copyLabel}
        onClick={onCopy}
        className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-r-md border-l text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <LuCopy className="h-4 w-4" />
      </button>
    </div>
  </div>
);

/** Copies a controller's token, which the table shows only by its last characters. */
const CopyTokenButton = ({ token }: { token: string }) => {
  const { t } = useTranslate();
  const label = t("studio.live_settings.controllers.copy_token");
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(token);
          toast.success(t("studio.live_settings.controllers.copied"));
        } catch {
          toast.error(t("studio.live_settings.controllers.copy_failed"));
        }
      }}
      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <LuCopy className="h-3.5 w-3.5" />
    </button>
  );
};

/**
 * The link to a controller, shown once: the backend keeps only the token's
 * hash, so this is the one time it can be copied or opened.
 */
const TokenDialog = ({
  eventId,
  controller,
  onClose,
}: {
  eventId: string;
  controller: LiveControllerWithToken | null;
  onClose: () => void;
}) => {
  const { t } = useTranslate();
  const link = controller ? controllerLink(eventId, controller.token) : "";
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("studio.live_settings.controllers.copied"));
    } catch {
      toast.error(t("studio.live_settings.controllers.copy_failed"));
    }
  };
  return (
    <Pecha.Dialog
      open={Boolean(controller)}
      onOpenChange={(open) => !open && onClose()}
    >
      <Pecha.DialogContent className="min-w-0 overflow-hidden sm:max-w-lg">
        <Pecha.DialogHeader className="min-w-0">
          <Pecha.DialogTitle className="break-words">
            {t("studio.live_settings.controllers.token_title", {
              name: controller?.name ?? "",
            })}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>
        <p className="min-w-0 text-sm break-words text-muted-foreground">
          {t("studio.live_settings.controllers.token_once")}
        </p>
        <CopyField
          label={t("studio.live_settings.controllers.link")}
          value={link}
          copyLabel={t("studio.live_settings.controllers.copy_link")}
          onCopy={() => copy(link)}
        />
        <CopyField
          label={t("studio.live_settings.controllers.token")}
          value={controller?.token ?? ""}
          copyLabel={t("studio.live_settings.controllers.copy_token")}
          onCopy={() => controller && copy(controller.token)}
        />
        <div className="flex min-w-0 flex-wrap justify-end gap-2">
          <Pecha.Button type="button" variant="outline" onClick={onClose}>
            {t("studio.common.close")}
          </Pecha.Button>
          <Pecha.Button
            type="button"
            onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
          >
            <LuExternalLink className="h-4 w-4" />
            {t("studio.live_settings.controllers.open")}
          </Pecha.Button>
        </div>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

const ControllerForm = ({
  draft,
  planTexts,
  pending,
  onChange,
  onSave,
  onCancel,
}: {
  draft: ControllerDraft;
  planTexts: PlanText[];
  pending: boolean;
  onChange: (draft: ControllerDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslate();
  const editing = draft.id !== null;
  const tokenTooShort =
    draft.ownToken && draft.token.trim().length < MIN_TOKEN_LENGTH;
  const knownDefault =
    draft.defaultTextId === NO_DEFAULT_TEXT ||
    planTexts.some((text) => text.text_id === draft.defaultTextId);
  return (
    <form
      className="grid gap-4 rounded-xl border border-dashed bg-muted/30 p-4 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.name.trim() || tokenTooShort) return;
        onSave();
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="controller-name" className="text-sm font-medium">
          {t("studio.live_settings.controllers.name")}
        </label>
        <Pecha.Input
          id="controller-name"
          value={draft.name}
          maxLength={120}
          placeholder={t("studio.live_settings.controllers.name_placeholder")}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">
          {editing
            ? t("studio.live_settings.controllers.new_token")
            : t("studio.live_settings.controllers.token")}
        </span>
        <div className="flex flex-wrap gap-2">
          {[false, true].map((own) => (
            <button
              key={String(own)}
              type="button"
              aria-pressed={draft.ownToken === own}
              onClick={() => onChange({ ...draft, ownToken: own })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                draft.ownToken === own
                  ? "border-[#A51C21] bg-[#A51C21]/10 text-foreground"
                  : "border-input text-muted-foreground hover:text-foreground",
              )}
            >
              {own
                ? t("studio.live_settings.controllers.set_own")
                : editing
                  ? t("studio.live_settings.controllers.keep_or_generate")
                  : t("studio.live_settings.controllers.generate")}
            </button>
          ))}
        </div>
        {draft.ownToken ? (
          <>
            <Pecha.Input
              aria-label={t("studio.live_settings.controllers.token")}
              className="font-mono text-xs"
              value={draft.token}
              maxLength={128}
              onChange={(e) =>
                onChange({
                  ...draft,
                  token: e.target.value.replace(/[^A-Za-z0-9_.~-]/g, ""),
                })
              }
            />
            {tokenTooShort ? (
              <p className="text-xs text-muted-foreground">
                {t("studio.live_settings.controllers.token_min", {
                  count: MIN_TOKEN_LENGTH,
                })}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">
          {t("studio.live_settings.controllers.default_text")}
        </span>
        <Pecha.Select
          value={draft.defaultTextId}
          onValueChange={(value: string) =>
            onChange({ ...draft, defaultTextId: value })
          }
        >
          <Pecha.SelectTrigger className="w-full bg-white dark:bg-[#181818]">
            <Pecha.SelectValue />
          </Pecha.SelectTrigger>
          <Pecha.SelectContent>
            <Pecha.SelectItem value={NO_DEFAULT_TEXT}>
              {t("studio.live_settings.controllers.no_default_text")}
            </Pecha.SelectItem>
            {planTexts.map((text) => (
              <Pecha.SelectItem key={text.text_id} value={text.text_id}>
                {text.title ?? text.text_id}
              </Pecha.SelectItem>
            ))}
            {knownDefault ? null : (
              <Pecha.SelectItem value={draft.defaultTextId}>
                {draft.defaultTextId}
              </Pecha.SelectItem>
            )}
          </Pecha.SelectContent>
        </Pecha.Select>
        <p className="text-xs text-muted-foreground">
          {t("studio.live_settings.controllers.default_text_help")}
        </p>
      </div>
      <div className="flex justify-end gap-2 sm:col-span-3">
        <Pecha.Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
        >
          {t("studio.common.cancel")}
        </Pecha.Button>
        <Pecha.Button
          type="submit"
          disabled={pending || !draft.name.trim() || tokenTooShort}
        >
          {pending ? t("studio.common.saving") : t("studio.common.save")}
        </Pecha.Button>
      </div>
    </form>
  );
};

export const LiveControllersSection = ({
  eventId,
  planTexts,
}: {
  eventId: string;
  planTexts: PlanText[];
}) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ControllerDraft | null>(null);
  const [shown, setShown] = useState<LiveControllerWithToken | null>(null);
  const [revoking, setRevoking] = useState<LiveController | null>(null);

  const { data: controllers = [], isLoading } = useQuery({
    queryKey: liveControlKeys.controllers(eventId),
    queryFn: () => fetchControllers(eventId),
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: liveControlKeys.controllers(eventId),
    });

  const save = useMutation({
    mutationFn: async (value: ControllerDraft) => {
      const defaultTextId =
        value.defaultTextId === NO_DEFAULT_TEXT ? null : value.defaultTextId;
      const token = value.ownToken ? value.token.trim() : undefined;
      if (value.id === null) {
        return createController(eventId, {
          name: value.name.trim(),
          token,
          default_text_id: defaultTextId,
        });
      }
      return updateController(eventId, value.id, {
        name: value.name.trim(),
        token,
        default_text_id: defaultTextId,
      });
    },
    onSuccess: (controller) => {
      setDraft(null);
      refresh();
      if (hasToken(controller)) setShown(controller);
      else toast.success(t("studio.live_settings.controllers.saved"));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const newToken = useMutation({
    mutationFn: (controller: LiveController) =>
      updateController(eventId, controller.id, { regenerate_token: true }),
    onSuccess: (controller) => {
      refresh();
      if (hasToken(controller)) setShown(controller);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const revoke = useMutation({
    mutationFn: (controller: LiveController) =>
      revokeController(eventId, controller.id),
    onSuccess: () => {
      setRevoking(null);
      refresh();
      toast.success(t("studio.live_settings.controllers.revoked_toast"));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const titleOf = (textId: string | null) =>
    textId
      ? (planTexts.find((text) => text.text_id === textId)?.title ?? textId)
      : null;

  return (
    <section
      aria-labelledby="live-controllers"
      className="space-y-4 rounded-2xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl space-y-1">
          <h2 id="live-controllers" className="text-base font-semibold">
            {t("studio.live_settings.controllers.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("studio.live_settings.controllers.description")}
          </p>
        </div>
        {draft ? null : (
          <Pecha.Button type="button" onClick={() => setDraft(emptyDraft)}>
            <LuPlus className="h-4 w-4" />
            {t("studio.live_settings.controllers.add")}
          </Pecha.Button>
        )}
      </div>

      {draft ? (
        <ControllerForm
          draft={draft}
          planTexts={planTexts}
          pending={save.isPending}
          onChange={setDraft}
          onSave={() => save.mutate(draft)}
          onCancel={() => setDraft(null)}
        />
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.common.loading")}
        </p>
      ) : controllers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.live_settings.controllers.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="w-10 px-2 py-2" />
                <th className="px-2 py-2 font-medium">
                  {t("studio.live_settings.controllers.name")}
                </th>
                <th className="px-2 py-2 font-medium">
                  {t("studio.live_settings.controllers.token")}
                </th>
                <th className="px-2 py-2 font-medium">
                  {t("studio.live_settings.controllers.default_text")}
                </th>
                <th className="px-2 py-2 font-medium">
                  {t("studio.live_settings.controllers.last_used")}
                </th>
                <th className="px-2 py-2 font-medium">
                  {t("studio.live_settings.controllers.status")}
                </th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {controllers.map((controller) => {
                const revoked = Boolean(controller.revoked_at);
                return (
                  <tr
                    key={controller.id}
                    className={cn(
                      "border-b last:border-0",
                      revoked && "opacity-55",
                    )}
                  >
                    <td className="px-2 py-3">
                      {/* Opens this controller in a new tab, already holding
                       * its token. */}
                      {controller.token && !revoked ? (
                        <button
                          type="button"
                          aria-label={t(
                            "studio.live_settings.controllers.open",
                          )}
                          title={t("studio.live_settings.controllers.open")}
                          onClick={() =>
                            window.open(
                              controllerLink(eventId, controller.token ?? ""),
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#A51C21] text-white hover:bg-[#8a171b]"
                        >
                          <LuPlay className="h-4 w-4 translate-x-px" />
                        </button>
                      ) : (
                        <span
                          title={
                            revoked
                              ? undefined
                              : t(
                                  "studio.live_settings.controllers.no_token_title",
                                )
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground opacity-50"
                        >
                          <LuPlay className="h-4 w-4 translate-x-px" />
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 font-medium">{controller.name}</td>
                    <td className="px-2 py-3 font-mono text-xs">
                      <span className="inline-flex items-center gap-1">
                        ••••{controller.token_hint}
                        {controller.token && !revoked ? (
                          <CopyTokenButton token={controller.token} />
                        ) : null}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      {titleOf(controller.default_text_id) ?? (
                        <span className="text-muted-foreground">
                          {t(
                            "studio.live_settings.controllers.no_default_text",
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">
                      {formatWhen(
                        controller.last_used_at,
                        t("studio.live_settings.controllers.never_used"),
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <Pecha.Badge variant={revoked ? "secondary" : "outline"}>
                        {revoked
                          ? t("studio.live_settings.controllers.revoked")
                          : t("studio.live_settings.controllers.active")}
                      </Pecha.Badge>
                    </td>
                    <td className="px-2 py-3">
                      {revoked ? null : (
                        <div className="flex justify-end gap-1.5">
                          <Pecha.Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={newToken.isPending}
                            onClick={() => newToken.mutate(controller)}
                          >
                            {t("studio.live_settings.controllers.new_link")}
                          </Pecha.Button>
                          <Pecha.Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setDraft({
                                id: controller.id,
                                name: controller.name,
                                ownToken: false,
                                token: "",
                                defaultTextId:
                                  controller.default_text_id ?? NO_DEFAULT_TEXT,
                              })
                            }
                          >
                            {t("studio.common.edit")}
                          </Pecha.Button>
                          <Pecha.Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setRevoking(controller)}
                          >
                            {t("studio.live_settings.controllers.revoke")}
                          </Pecha.Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t("studio.live_settings.controllers.footnote")}
      </p>

      <TokenDialog
        eventId={eventId}
        controller={shown}
        onClose={() => setShown(null)}
      />

      <Pecha.AlertDialog
        open={Boolean(revoking)}
        onOpenChange={(open) => !open && setRevoking(null)}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t("studio.live_settings.controllers.revoke_title", {
                name: revoking?.name ?? "",
              })}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {t("studio.live_settings.controllers.revoke_body")}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel>
              {t("studio.common.cancel")}
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (revoking) revoke.mutate(revoking);
              }}
              disabled={revoke.isPending}
            >
              {t("studio.live_settings.controllers.revoke")}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </section>
  );
};
