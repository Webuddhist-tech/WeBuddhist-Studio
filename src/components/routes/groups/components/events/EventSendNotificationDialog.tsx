import { useState } from "react";
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
};

const TITLE_MAX = 120;
const BODY_MAX = 500;

const AUDIENCE_OPTIONS: {
  value: EventNotificationAudience;
  label: string;
  hint: string;
}[] = [
  {
    value: "participants",
    label: "People attending",
    hint: "Everyone who has joined this event.",
  },
  {
    value: "group",
    label: "The whole group",
    hint: "Every member of the group, whether or not they have joined.",
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
}: EventSendNotificationDialogProps) => {
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
      toast.success("Notification queued for delivery");
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Could not send the notification"));
    },
  });

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !sendMutation.isPending;

  return (
    <>
      <Pecha.Button
        type="button"
        variant="outline"
        disabled={disabled || !notificationsEnabled}
        onClick={() => setOpen(true)}
        title={
          notificationsEnabled
            ? undefined
            : "Notifications are turned off for this event"
        }
      >
        Send a notification
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
            <Pecha.DialogTitle>Send a notification</Pecha.DialogTitle>
          </Pecha.DialogHeader>

          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Goes out straight away as a push notification about{" "}
              <span className="font-medium">{eventName}</span>. It cannot be
              edited or taken back once sent.
            </p>

            <div className="space-y-1">
              <label
                htmlFor="event-notification-title"
                className="text-sm font-medium"
              >
                Title
              </label>
              <Pecha.Input
                id="event-notification-title"
                value={title}
                maxLength={TITLE_MAX}
                placeholder="Change of venue"
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
                Message
              </label>
              <Pecha.Textarea
                id="event-notification-body"
                value={body}
                maxLength={BODY_MAX}
                rows={4}
                placeholder="We are meeting in the main hall today, not the annexe."
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setBody(event.target.value)
                }
              />
              <p className="text-right text-xs text-muted-foreground">
                {body.length}/{BODY_MAX}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Send to</p>
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
                        {option.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </Pecha.RadioGroup>
            </div>

            <p className="text-xs text-muted-foreground">
              People who muted this event, or turned event notifications off
              altogether, will not receive it.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Pecha.Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={sendMutation.isPending}
              >
                Cancel
              </Pecha.Button>
              <Pecha.Button
                type="button"
                disabled={!canSend}
                onClick={() => sendMutation.mutate()}
              >
                {sendMutation.isPending ? "Sending..." : "Send now"}
              </Pecha.Button>
            </div>
          </div>
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </>
  );
};

export default EventSendNotificationDialog;
