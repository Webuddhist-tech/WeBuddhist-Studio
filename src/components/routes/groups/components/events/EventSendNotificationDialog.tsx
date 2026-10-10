import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  sendCmsEventNotification,
  type EventNotificationAudience,
} from "../../api/eventsApi";

type EventSendNotificationDialogProps = {
  eventId: string;
  eventName: string;
  notificationsEnabled: boolean;
  disabled?: boolean;
  /** Why sending is unavailable, shown on the disabled button. */
  disabledReason?: string;
};

const TITLE_MAX = 120;
const BODY_MAX = 500;

const AUDIENCE_OPTIONS: {
  value: EventNotificationAudience;
  labelKey: string;
  hintKey: string;
}[] = [
  {
    value: "participants",
    labelKey: "studio.groups.events.send_notification.audience_participants",
    hintKey:
      "studio.groups.events.send_notification.audience_participants_hint",
  },
  {
    value: "group",
    labelKey: "studio.groups.events.send_notification.audience_group",
    hintKey: "studio.groups.events.send_notification.audience_group_hint",
  },
];

/**
 * Sends a one-off push about this event.
 *
 * Deliberately a dialog with an explicit confirm rather than an inline field:
 * a send reaches people's phones immediately and cannot be recalled, so it
 * should not be one stray click away. What is sent is not stored anywhere, so
 * there is no history to review afterwards either.
 */
const EventSendNotificationDialog = ({
  eventId,
  eventName,
  notificationsEnabled,
  disabled = false,
  disabledReason,
}: EventSendNotificationDialogProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] =
    useState<EventNotificationAudience>("participants");

  const reset = () => {
    setTitle("");
    setBody("");
    setAudience("participants");
  };

  const sendMutation = useMutation({
    mutationFn: () =>
      sendCmsEventNotification(eventId, {
        title: title.trim(),
        body: body.trim(),
        audience,
      }),
    onSuccess: () => {
      toast.success(t("studio.groups.events.send_notification.success"));
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(
          error,
          t("studio.groups.events.send_notification.error"),
        ),
      );
    },
  });

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !sendMutation.isPending;

  // The caller's reason wins: it describes a state the organizer can act on
  // (save first), while "notifications are off" describes the saved event.
  const blockedReason = disabled
    ? disabledReason
    : notificationsEnabled
      ? undefined
      : t("studio.groups.events.send_notification.notifications_off");

  return (
    <>
      <Pecha.Button
        type="button"
        variant="outline"
        disabled={disabled || !notificationsEnabled}
        onClick={() => setOpen(true)}
        title={blockedReason}
      >
        {t("studio.groups.events.send_notification.button")}
      </Pecha.Button>

      <Pecha.Dialog
        open={open}
        onOpenChange={(next: boolean) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <Pecha.DialogContent className="sm:max-w-lg">
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>
              {t("studio.groups.events.send_notification.title")}
            </Pecha.DialogTitle>
          </Pecha.DialogHeader>

          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {t("studio.groups.events.send_notification.intro_before")}{" "}
              <span className="font-medium">{eventName}</span>
              {t("studio.groups.events.send_notification.intro_after")}
            </p>

            <div className="space-y-1">
              <label
                htmlFor="event-notification-title"
                className="text-sm font-medium"
              >
                {t("studio.common.title")}
              </label>
              <Pecha.Input
                id="event-notification-title"
                value={title}
                maxLength={TITLE_MAX}
                placeholder={t(
                  "studio.groups.events.send_notification.title_placeholder",
                )}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setTitle(event.target.value)
                }
              />
              <p className="text-right text-xs text-muted-foreground">
                {title.length}/{TITLE_MAX}
              </p>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="event-notification-body"
                className="text-sm font-medium"
              >
                {t("studio.groups.events.send_notification.message_label")}
              </label>
              <Pecha.Textarea
                id="event-notification-body"
                value={body}
                maxLength={BODY_MAX}
                rows={4}
                placeholder={t(
                  "studio.groups.events.send_notification.message_placeholder",
                )}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setBody(event.target.value)
                }
              />
              <p className="text-right text-xs text-muted-foreground">
                {body.length}/{BODY_MAX}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t("studio.groups.events.send_notification.send_to")}
              </p>
              <Pecha.RadioGroup
                value={audience}
                onValueChange={(value: string) =>
                  setAudience(value as EventNotificationAudience)
                }
                className="space-y-2"
              >
                {AUDIENCE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3"
                  >
                    <Pecha.RadioGroupItem
                      value={option.value}
                      className="mt-1"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">
                        {t(option.labelKey)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t(option.hintKey)}
                      </span>
                    </span>
                  </label>
                ))}
              </Pecha.RadioGroup>
            </div>

            <p className="text-xs text-muted-foreground">
              {t("studio.groups.events.send_notification.muted_note")}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Pecha.Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={sendMutation.isPending}
              >
                {t("studio.common.cancel")}
              </Pecha.Button>
              <Pecha.Button
                type="button"
                disabled={!canSend}
                onClick={() => sendMutation.mutate()}
              >
                {sendMutation.isPending
                  ? t("studio.groups.events.send_notification.sending")
                  : t("studio.groups.events.send_notification.send_now")}
              </Pecha.Button>
            </div>
          </div>
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </>
  );
};

export default EventSendNotificationDialog;
