import { useCallback } from "react";
import { useForm, useFieldArray, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  eventSchema,
  eventEditSchema,
  defaultEventFormValues,
  emptyMetadataRow,
  emptyLinkRow,
  emptyYoutubeRow,
  emptyRecurrence,
  type EventFormData,
  type LanguageCode,
  type RecurrenceFormData,
} from "@/schema/EventSchema";
import { useLanguages, type StudioLanguageOption } from "@/hooks/useLanguages";

export type UseEventFormReturn = {
  form: UseFormReturn<EventFormData>;
  metadataRows: ReturnType<typeof useFieldArray<EventFormData, "metadata">>;
  linkRows: ReturnType<typeof useFieldArray<EventFormData, "links">>;
  youtubeRows: ReturnType<typeof useFieldArray<EventFormData, "youtube">>;
  usedLanguages: LanguageCode[];
  availableLanguages: StudioLanguageOption[];
  addMetadataRow: () => void;
  removeMetadataRow: (index: number) => void;
  addLinkRow: () => void;
  removeLinkRow: (index: number) => void;
  moveLinkRow: (from: number, to: number) => void;
  addYoutubeRow: () => void;
  removeYoutubeRow: (index: number) => void;
  moveYoutubeRow: (from: number, to: number) => void;
  setImageUrl: (url: string) => void;
  setLocationId: (id: string) => void;
  setOneDay: (oneDay: boolean) => void;
  setStartDate: (dateOnly: string) => void;
  setEndDate: (dateOnly: string) => void;
  setStartTime: (hhmm: string | null) => void;
  setEndTime: (hhmm: string | null) => void;
  setTimezone: (timezone: string) => void;
  setIsRecurring: (isRecurring: boolean) => void;
  setRecurrence: (recurrence: RecurrenceFormData | null) => void;
};

/** `isNew` is required on purpose: it picks the resolver, and defaulting it
 *  silently gave edit mode the create schema - rejecting a past start date on
 *  an event that has already happened. Let the compiler ask the caller. */
export const useEventForm = (isNew: boolean): UseEventFormReturn => {
  const { languageOptions } = useLanguages();
  const form = useForm<EventFormData>({
    resolver: zodResolver(isNew ? eventSchema : eventEditSchema),
    defaultValues: defaultEventFormValues(),
    mode: "onChange",
  });

  const metadataRows = useFieldArray({
    control: form.control,
    name: "metadata",
  });

  const linkRows = useFieldArray({
    control: form.control,
    name: "links",
  });

  const youtubeRows = useFieldArray({
    control: form.control,
    name: "youtube",
  });

  const metadata = form.watch("metadata") ?? [];
  const usedLanguages = metadata.map((m) => m.language);
  const availableLanguages = languageOptions.filter(
    ({ value }) => !usedLanguages.includes(value),
  );

  const addMetadataRow = useCallback(() => {
    const current = form.getValues("metadata") ?? [];
    const used = new Set(current.map((m) => m.language));
    const next = languageOptions
      .map((l) => l.value as LanguageCode)
      .find((code) => !used.has(code));
    if (!next) return;
    metadataRows.append(emptyMetadataRow(next));
  }, [form, metadataRows, languageOptions]);

  const removeMetadataRow = useCallback(
    (index: number) => {
      if ((form.getValues("metadata") ?? []).length <= 1) return;
      metadataRows.remove(index);
    },
    [form, metadataRows],
  );

  const defaultRowLanguage = useCallback((): LanguageCode => {
    const current = form.getValues("metadata") ?? [];
    return (current[0]?.language as LanguageCode | undefined) ?? "EN";
  }, [form]);

  const addLinkRow = useCallback(() => {
    linkRows.append(emptyLinkRow(defaultRowLanguage()));
  }, [linkRows, defaultRowLanguage]);

  const removeLinkRow = useCallback(
    (index: number) => {
      linkRows.remove(index);
    },
    [linkRows],
  );

  const moveLinkRow = useCallback(
    (from: number, to: number) => {
      const count = form.getValues("links")?.length ?? 0;
      if (to < 0 || to >= count || from === to) return;
      linkRows.move(from, to);
      // move() alone does not flip isDirty; mark the field so Save enables.
      form.setValue(`links.${to}.type`, form.getValues(`links.${to}.type`), {
        shouldDirty: true,
      });
    },
    [form, linkRows],
  );

  const addYoutubeRow = useCallback(() => {
    youtubeRows.append(emptyYoutubeRow(defaultRowLanguage()));
  }, [youtubeRows, defaultRowLanguage]);

  const removeYoutubeRow = useCallback(
    (index: number) => {
      youtubeRows.remove(index);
    },
    [youtubeRows],
  );

  const moveYoutubeRow = useCallback(
    (from: number, to: number) => {
      const count = form.getValues("youtube")?.length ?? 0;
      if (to < 0 || to >= count || from === to) return;
      youtubeRows.move(from, to);
      // move() alone does not flip isDirty; mark the field so Save enables.
      form.setValue(`youtube.${to}.url`, form.getValues(`youtube.${to}.url`), {
        shouldDirty: true,
      });
    },
    [form, youtubeRows],
  );

  const setImageUrl = useCallback(
    (url: string) => {
      form.setValue("image_url", url, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  const setLocationId = useCallback(
    (id: string) => {
      form.setValue("location_id", id, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  const setStartDate = useCallback(
    (dateOnly: string) => {
      form.setValue("start_date", dateOnly, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (form.getValues("is_one_day")) {
        form.setValue("end_date", dateOnly, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    },
    [form],
  );

  const setEndDate = useCallback(
    (dateOnly: string) => {
      form.setValue("end_date", dateOnly, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  const setStartTime = useCallback(
    (hhmm: string | null) => {
      form.setValue("start_time", hhmm, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  const setEndTime = useCallback(
    (hhmm: string | null) => {
      form.setValue("end_time", hhmm, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  const setTimezone = useCallback(
    (timezone: string) => {
      form.setValue("timezone", timezone, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  const setOneDay = useCallback(
    (oneDay: boolean) => {
      form.setValue("is_one_day", oneDay, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (oneDay) {
        const start = form.getValues("start_date");
        if (start) {
          form.setValue("end_date", start, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
      }
    },
    [form],
  );

  const setIsRecurring = useCallback(
    (isRecurring: boolean) => {
      form.setValue("is_recurring", isRecurring, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (isRecurring && !form.getValues("recurrence")) {
        form.setValue("recurrence", emptyRecurrence(), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    },
    [form],
  );

  const setRecurrence = useCallback(
    (recurrence: RecurrenceFormData | null) => {
      form.setValue("recurrence", recurrence, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form],
  );

  return {
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
  };
};
