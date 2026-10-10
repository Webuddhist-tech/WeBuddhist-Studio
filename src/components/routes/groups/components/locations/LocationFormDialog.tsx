import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { useLanguages } from "@/hooks/useLanguages";
import {
  locationSchema,
  defaultLocationFormValues,
  coordinateToInput,
  type LocationFormData,
} from "@/schema/LocationSchema";
import type { EventLocation, LocationDetail } from "../../api/locationsApi";
import {
  isPlaceSearchEnabled,
  reverseGeocode,
  type PlaceResult,
} from "../../api/placeSearchApi";
import LocationMap, { type Coordinates } from "./LocationMap";
import PlaceSearch from "./PlaceSearch";

type LocationFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: LocationDetail | EventLocation | null;
  isSubmitting: boolean;
  onSubmit: (data: LocationFormData) => void;
  initialName?: string;
};

const SET_VALUE_OPTIONS = { shouldDirty: true, shouldValidate: true } as const;

const LocationFormDialog = ({
  open,
  onOpenChange,
  location,
  isSubmitting,
  onSubmit,
  initialName = "",
}: LocationFormDialogProps) => {
  const { t } = useTranslate();
  const isEdit = Boolean(location);

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: defaultLocationFormValues(),
    mode: "onChange",
  });

  useEffect(() => {
    if (!open) return;
    if (location) {
      form.reset({
        name: location.name,
        latitude: coordinateToInput(location.latitude),
        longitude: coordinateToInput(location.longitude),
        translations: ((location as LocationDetail).translations ?? []).map(
          (entry) => ({ language: entry.language, name: entry.name }),
        ),
      });
    } else {
      form.reset({ ...defaultLocationFormValues(), name: initialName });
    }
  }, [open, location, initialName, form]);

  const translationRows = useFieldArray({
    control: form.control,
    name: "translations",
  });
  const { languageOptions } = useLanguages();
  const translations = form.watch("translations") ?? [];
  const usedLanguages = translations.map((entry) => entry.language);
  const nextUnusedLanguage = languageOptions.find(
    (option) => !usedLanguages.includes(option.value),
  );

  const addTranslationRow = () => {
    if (!nextUnusedLanguage) return;
    translationRows.append({ language: nextUnusedLanguage.value, name: "" });
  };

  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const reverseAbortRef = useRef<AbortController | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const latitude = form.watch("latitude");
  const longitude = form.watch("longitude");

  const pin: Coordinates | null = useMemo(() => {
    if (latitude === "" || longitude === "") return null;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [latitude, longitude]);

  useEffect(() => {
    if (!open) {
      reverseAbortRef.current?.abort();
      setSuggestedName(null);
    }
  }, [open]);

  useEffect(() => {
    return () => reverseAbortRef.current?.abort();
  }, []);

  const writeCoordinates = useCallback(
    (coords: Coordinates) => {
      form.setValue(
        "latitude",
        String(Number(coords.lat.toFixed(6))),
        SET_VALUE_OPTIONS,
      );
      form.setValue(
        "longitude",
        String(Number(coords.lng.toFixed(6))),
        SET_VALUE_OPTIONS,
      );
    },
    [form],
  );

  const setPin = useCallback(
    (coords: Coordinates) => {
      writeCoordinates(coords);
      setSuggestedName(null);

      if (!isPlaceSearchEnabled()) return;

      reverseAbortRef.current?.abort();
      const controller = new AbortController();
      reverseAbortRef.current = controller;

      reverseGeocode(coords.lat, coords.lng, controller.signal)
        .then((name) => {
          if (controller.signal.aborted || !name) return;
          if (name.trim() === form.getValues("name").trim()) return;
          setSuggestedName(name);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestedName(null);
        });
    },
    [form, writeCoordinates],
  );

  const clearPin = () => {
    reverseAbortRef.current?.abort();
    form.setValue("latitude", "", SET_VALUE_OPTIONS);
    form.setValue("longitude", "", SET_VALUE_OPTIONS);
    setSuggestedName(null);
  };

  const applySuggestedName = () => {
    if (!suggestedName) return;
    form.setValue("name", suggestedName.slice(0, 255), SET_VALUE_OPTIONS);
    setSuggestedName(null);
  };

  const handlePlaceSelected = useCallback(
    (place: PlaceResult) => {
      writeCoordinates({ lat: place.latitude, lng: place.longitude });
      setSuggestedName(null);
      if (!form.getValues("name").trim()) {
        form.setValue("name", place.primary.slice(0, 255), SET_VALUE_OPTIONS);
      }
    },
    [form, writeCoordinates],
  );

  const handleSubmit = form.handleSubmit((data) => onSubmit(data));

  const eventCount = (location as LocationDetail | null)?.event_count ?? 0;
  const showSharedWarning = isEdit && eventCount > 0;

  const getSubmitLabel = () => {
    if (isSubmitting)
      return isEdit ? t("studio.common.saving") : t("studio.common.creating");
    return isEdit
      ? t("studio.groups.shared.save_changes")
      : t("studio.groups.locations.form.create_submit");
  };

  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      <Pecha.DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            const input = nameInputRef.current;
            if (!input) return;
            input.focus();
            const end = input.value.length;
            input.setSelectionRange(end, end);
          });
        }}
      >
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>
            {isEdit
              ? t("studio.groups.locations.form.edit_title")
              : t("studio.groups.locations.form.new_title")}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>

        {showSharedWarning ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {eventCount === 1
              ? t("studio.groups.locations.form.shared_warning_one")
              : t("studio.groups.locations.form.shared_warning_other", {
                  count: eventCount,
                })}
          </p>
        ) : null}

        <Pecha.Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Pecha.FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <Pecha.FormItem>
                  <Pecha.FormLabel>{t("studio.common.name")}</Pecha.FormLabel>
                  <Pecha.FormControl>
                    <Pecha.Input
                      {...field}
                      ref={(element) => {
                        field.ref(element);
                        nameInputRef.current = element;
                      }}
                      placeholder={t(
                        "studio.groups.locations.form.name_placeholder",
                      )}
                      maxLength={255}
                    />
                  </Pecha.FormControl>
                  <Pecha.FormMessage />
                </Pecha.FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {t("studio.groups.locations.form.localized_names")}
                </p>
                {nextUnusedLanguage ? (
                  <Pecha.Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTranslationRow}
                    className="gap-1"
                  >
                    <IoMdAdd className="h-4 w-4" />{" "}
                    {t("studio.groups.locations.form.add_language")}
                  </Pecha.Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("studio.groups.locations.form.localized_names_hint")}
              </p>

              {translationRows.fields.map((field, index) => {
                const currentLanguage = translations[index]?.language;
                return (
                  <div key={field.id} className="flex items-start gap-2">
                    <Pecha.FormField
                      control={form.control}
                      name={`translations.${index}.language`}
                      render={({ field: languageField }) => (
                        <Pecha.FormItem className="w-32 shrink-0">
                          <Pecha.Select
                            value={languageField.value}
                            onValueChange={languageField.onChange}
                          >
                            <Pecha.FormControl>
                              <Pecha.SelectTrigger className="w-full">
                                <Pecha.SelectValue
                                  placeholder={t("studio.common.language")}
                                />
                              </Pecha.SelectTrigger>
                            </Pecha.FormControl>
                            <Pecha.SelectContent>
                              {languageOptions.map((option) => (
                                <Pecha.SelectItem
                                  key={option.value}
                                  value={option.value}
                                  disabled={
                                    usedLanguages.includes(option.value) &&
                                    option.value !== currentLanguage
                                  }
                                >
                                  {option.label}
                                </Pecha.SelectItem>
                              ))}
                            </Pecha.SelectContent>
                          </Pecha.Select>
                          <Pecha.FormMessage />
                        </Pecha.FormItem>
                      )}
                    />
                    <Pecha.FormField
                      control={form.control}
                      name={`translations.${index}.name`}
                      render={({ field: nameField }) => (
                        <Pecha.FormItem className="flex-1">
                          <Pecha.FormControl>
                            <Pecha.Input
                              {...nameField}
                              placeholder={t(
                                "studio.groups.locations.form.translation_name_placeholder",
                              )}
                              maxLength={255}
                            />
                          </Pecha.FormControl>
                          <Pecha.FormMessage />
                        </Pecha.FormItem>
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => translationRows.remove(index)}
                      aria-label={t(
                        "studio.groups.locations.form.remove_localized_name",
                      )}
                      className="mt-2 cursor-pointer p-1 text-muted-foreground hover:text-foreground"
                    >
                      <IoMdClose className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {t("studio.groups.locations.form.place")}
                </p>
                {pin ? (
                  <button
                    type="button"
                    onClick={clearPin}
                    className="cursor-pointer text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    {t("studio.common.clear")}
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {isPlaceSearchEnabled()
                  ? t("studio.groups.locations.form.place_hint_with_search")
                  : t("studio.groups.locations.form.place_hint")}
              </p>

              <PlaceSearch onSelect={handlePlaceSelected} />

              <LocationMap value={pin} onChange={setPin} />

              {suggestedName ? (
                <p className="text-xs text-muted-foreground">
                  {t("studio.groups.locations.form.nearest_place", {
                    name: suggestedName,
                  })}{" "}
                  <button
                    type="button"
                    onClick={applySuggestedName}
                    className="cursor-pointer underline hover:text-foreground"
                  >
                    {t("studio.groups.locations.form.use_as_name")}
                  </button>
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <Pecha.FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <Pecha.FormItem>
                      <Pecha.FormLabel>
                        {t("studio.groups.locations.form.latitude")}
                      </Pecha.FormLabel>
                      <Pecha.FormControl>
                        <Pecha.Input
                          {...field}
                          inputMode="decimal"
                          placeholder={t(
                            "studio.groups.locations.form.latitude_placeholder",
                          )}
                        />
                      </Pecha.FormControl>
                      <Pecha.FormMessage />
                    </Pecha.FormItem>
                  )}
                />
                <Pecha.FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <Pecha.FormItem>
                      <Pecha.FormLabel>
                        {t("studio.groups.locations.form.longitude")}
                      </Pecha.FormLabel>
                      <Pecha.FormControl>
                        <Pecha.Input
                          {...field}
                          inputMode="decimal"
                          placeholder={t(
                            "studio.groups.locations.form.longitude_placeholder",
                          )}
                        />
                      </Pecha.FormControl>
                      <Pecha.FormMessage />
                    </Pecha.FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Pecha.Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("studio.common.cancel")}
              </Pecha.Button>
              <Pecha.Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#A51C21] font-medium text-white hover:bg-[#A51C21]/90 disabled:opacity-50"
              >
                {getSubmitLabel()}
              </Pecha.Button>
            </div>
          </form>
        </Pecha.Form>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default LocationFormDialog;
