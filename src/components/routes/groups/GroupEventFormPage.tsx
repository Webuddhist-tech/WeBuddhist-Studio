import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { ROUTES } from "@/routes/paths";
import type { GroupOutletContext } from "./GroupLayout";
import { useEventForm } from "./hooks/useEventForm";
import { useEventImage } from "./hooks/useEventImage";
import { canWriteEvents } from "./lib/eventPermissions";
import {
  buildCreateEventBody,
  buildUpdateEventBody,
  createCmsEvent,
  fetchCmsEvent,
  mapEventToFormData,
  resolveLinkedAccumulator,
  resolveLinkedGroupAccumulator,
  resolveLinkedChantCollection,
  resolveLinkedContent,
  eventName,
  updateCmsEvent,
  type EventDTO,
  type ImageUrlModel,
} from "./api/eventsApi";
import type { FkOption } from "./components/FkMultiSearchSelector";
import EventMetadataRows from "./components/events/EventMetadataRows";
import EventDateSection from "./components/events/EventDateSection";
import EventLinksSection from "./components/events/EventLinksSection";
import EventUrlLinksSection from "./components/events/EventUrlLinksSection";
import EventYoutubeSection from "./components/events/EventYoutubeSection";
import EventImageField from "./components/events/EventImageField";
import EventFormatField from "./components/events/EventFormatField";
import EventChatField from "./components/events/EventChatField";
import EventNotificationsField from "./components/events/EventNotificationsField";
import EventSendNotificationDialog from "./components/events/EventSendNotificationDialog";
import LocationPicker from "./components/locations/LocationPicker";
import type { EventLocation } from "./api/locationsApi";
import type { EventFormData } from "@/schema/EventSchema";

function resolveEventImageUrl(event: EventDTO): string | null {
  const image = event.image as ImageUrlModel | undefined;
  if (image?.original) return image.original;
  if (image?.medium) return image.medium;
  if (event.image_url && /^https?:\/\//i.test(event.image_url)) {
    return event.image_url;
  }
  return null;
}

const GroupEventFormPage = () => {
  const { groupId, eventId } = useParams<{
    groupId: string;
    eventId?: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { myRole, userInfo, readOnlyPlatform } =
    useOutletContext<GroupOutletContext>();

  const isNew = !eventId;
  const canWrite =
    !readOnlyPlatform && canWriteEvents(myRole, userInfo?.platform_role);
  const readOnly = !canWrite;

  const {
    form,
    metadataRows,
    linkRows,
    youtubeRows,
    usedLanguages,
    availableLanguages,
    addMetadataRow,
    removeMetadataRow,
    addLinkRow,
    removeLinkRow,
    moveLinkRow,
    addYoutubeRow,
    removeYoutubeRow,
    moveYoutubeRow,
    setImageUrl,
    setLocationId,
    setOneDay,
    setStartDate,
    setEndDate,
    setStartTime,
    setEndTime,
    setTimezone,
    setIsRecurring,
    setRecurrence,
  } = useEventForm();

  const image = useEventImage({ setImageUrl });
  const { setImagePreview, setSelectedImage } = image;

  const [contentValue, setContentValue] = useState<FkOption | null>(null);
  const [accumulatorValue, setAccumulatorValue] = useState<FkOption | null>(
    null,
  );
  const [groupAccumulatorValue, setGroupAccumulatorValue] =
    useState<FkOption | null>(null);
  const [chantValue, setChantValue] = useState<FkOption | null>(null);
  const [locationValue, setLocationValue] = useState<EventLocation | null>(
    null,
  );

  const eventQuery = useQuery({
    queryKey: ["cms-event", eventId],
    queryFn: () => fetchCmsEvent(eventId ?? ""),
    enabled: Boolean(eventId) && !isNew,
    refetchOnWindowFocus: false,
  });
  const eventData = eventQuery.data;

  const originalRef = useRef<EventFormData | null>(null);
  const hydratedIdRef = useRef<string | null>(null);
  useEffect(() => {
    hydratedIdRef.current = null;
  }, [eventId]);

  useEffect(() => {
    if (isNew || !eventData) return;
    if (hydratedIdRef.current === eventData.id) return;
    hydratedIdRef.current = eventData.id;
    const formData = mapEventToFormData(eventData);
    originalRef.current = formData;
    form.reset(formData);
    setImagePreview(resolveEventImageUrl(eventData));
    setSelectedImage(null);

    if (formData.plan_id && groupId) {
      resolveLinkedContent(groupId, formData.plan_id, "plan").then(
        setContentValue,
      );
    } else if (formData.series_id && groupId) {
      resolveLinkedContent(groupId, formData.series_id, "series").then(
        setContentValue,
      );
    } else {
      setContentValue(null);
    }
    if (formData.accumulator_id) {
      resolveLinkedAccumulator(formData.accumulator_id).then(
        setAccumulatorValue,
      );
    } else {
      setAccumulatorValue(null);
    }
    if (formData.group_accumulator_id && groupId) {
      resolveLinkedGroupAccumulator(
        groupId,
        formData.group_accumulator_id,
      ).then(setGroupAccumulatorValue);
    } else {
      setGroupAccumulatorValue(null);
    }
    if (formData.group_recitation_collection_id && groupId) {
      resolveLinkedChantCollection(
        groupId,
        formData.group_recitation_collection_id,
      ).then(setChantValue);
    } else {
      setChantValue(null);
    }
    setLocationValue(eventData.location ?? null);
  }, [isNew, eventData, form, groupId, setImagePreview, setSelectedImage]);

  const eventsListPath = groupId ? ROUTES.groupEvents(groupId) : ROUTES.groups;

  const mutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      if (isNew) {
        return createCmsEvent(buildCreateEventBody(data, groupId ?? ""));
      }
      const original = originalRef.current ?? mapEventToFormData(eventData!);
      return updateCmsEvent(
        eventId ?? "",
        buildUpdateEventBody(data, original),
      );
    },
    onSuccess: () => {
      toast.success(isNew ? "Event created" : "Event updated");
      queryClient.invalidateQueries({ queryKey: ["cms-events", groupId] });
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ["cms-event", eventId] });
      }
      navigate(eventsListPath);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const onSubmit = form.handleSubmit((data) => {
    if (readOnly) return;
    mutation.mutate(data);
  });

  if (!isNew && eventQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading event…
      </div>
    );
  }

  if (!isNew && eventQuery.isError) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <p className="text-center text-destructive">
          {getApiErrorMessage(eventQuery.error, "Could not load this event.")}
        </p>
        <Pecha.Button
          variant="outline"
          onClick={() => navigate(eventsListPath)}
        >
          Back to events
        </Pecha.Button>
      </div>
    );
  }

  const isOneDay = form.watch("is_one_day");

  const getSaveLabel = () => {
    if (mutation.isPending) return isNew ? "Creating…" : "Saving…";
    return isNew ? "Create event" : "Save changes";
  };

  const saveDisabled =
    readOnly || mutation.isPending || (!isNew && !form.formState.isDirty);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {isNew ? "New event" : "Edit event"}
        </h1>
        {/* Only once the event exists: there is nobody to notify about an
            event that has not been created yet. */}
        {!isNew && !readOnly && eventData ? (
          <EventSendNotificationDialog
            eventId={eventData.id}
            eventName={eventName(eventData)}
            notificationsEnabled={eventData.notifications_enabled ?? true}
          />
        ) : null}
      </div>

      {readOnly ? (
        <p className="text-sm text-muted-foreground">
          You do not have permission to {isNew ? "create" : "edit"} events in
          this group.
        </p>
      ) : null}

      <Pecha.Form {...form}>
        <form onSubmit={onSubmit} className="space-y-8">
          <EventDateSection
            form={form}
            isOneDay={isOneDay}
            readOnly={readOnly}
            isNew={isNew}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
            onTimezoneChange={setTimezone}
            onOneDayChange={setOneDay}
            onIsRecurringChange={setIsRecurring}
            onRecurrenceChange={setRecurrence}
          />

          <EventMetadataRows
            form={form}
            fields={metadataRows.fields}
            usedLanguages={usedLanguages}
            canAddLanguage={availableLanguages.length > 0}
            readOnly={readOnly}
            onAdd={addMetadataRow}
            onRemove={removeMetadataRow}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <LocationPicker
              groupId={groupId ?? ""}
              value={locationValue}
              readOnly={readOnly}
              canCreate={canWrite}
              onChange={(location) => {
                setLocationValue(location);
                setLocationId(location?.id ?? "");
              }}
            />

            <EventFormatField form={form} readOnly={readOnly} />

            <EventChatField form={form} readOnly={readOnly} />

            <EventNotificationsField form={form} readOnly={readOnly} />
          </div>

          <EventLinksSection
            form={form}
            groupId={groupId ?? ""}
            readOnly={readOnly}
            contentValue={contentValue}
            accumulatorValue={accumulatorValue}
            groupAccumulatorValue={groupAccumulatorValue}
            chantValue={chantValue}
            onContentChange={setContentValue}
            onAccumulatorChange={setAccumulatorValue}
            onGroupAccumulatorChange={setGroupAccumulatorValue}
            onChantChange={setChantValue}
          />

          <EventYoutubeSection
            form={form}
            fields={youtubeRows.fields}
            readOnly={readOnly}
            onAdd={addYoutubeRow}
            onRemove={removeYoutubeRow}
            onMove={moveYoutubeRow}
          />

          <EventUrlLinksSection
            form={form}
            fields={linkRows.fields}
            readOnly={readOnly}
            onAdd={addLinkRow}
            onRemove={removeLinkRow}
            onMove={moveLinkRow}
          />

          <EventImageField
            imagePreview={image.imagePreview}
            selectedImage={image.selectedImage}
            isDialogOpen={image.isImageDialogOpen}
            isUploading={image.isImageUploading}
            readOnly={readOnly}
            onOpenDialog={image.openImageDialog}
            onDialogOpenChange={image.setImageDialogOpen}
            onUpload={image.uploadImage}
            onRemove={image.removeImage}
          />

          <div className="flex justify-end gap-3 border-t border-dashed border-border pt-6">
            <Pecha.Button
              type="button"
              variant="outline"
              onClick={() => navigate(eventsListPath)}
            >
              Cancel
            </Pecha.Button>
            {!readOnly ? (
              <Pecha.Button
                type="submit"
                disabled={saveDisabled}
                className="bg-[#A51C21] font-medium text-white hover:bg-[#A51C21]/90 disabled:opacity-50"
              >
                {getSaveLabel()}
              </Pecha.Button>
            ) : null}
          </div>
        </form>
      </Pecha.Form>
    </div>
  );
};

export default GroupEventFormPage;
