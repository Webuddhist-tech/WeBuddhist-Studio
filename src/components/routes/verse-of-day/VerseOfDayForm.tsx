import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Textarea } from "@/components/ui/atoms/textarea";
import { Input } from "@/components/ui/atoms/input";
import { Button } from "@/components/ui/atoms/button";
import { Calendar } from "@/components/ui/atoms/calendar";
import { useLanguages } from "@/hooks/useLanguages";
import type { LanguageCode } from "@/lib/languageCodes";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  createVerseOfDay,
  updateVerseOfDay,
  type VerseOfDayPayload,
  type VerseOfDayItem,
  type VerseContent,
} from "./api/verseOfDayApi";
import { uploadImageToS3 } from "@/components/routes/task/api/taskApi";
import ImageContentData from "@/components/ui/molecules/modals/image-upload/ImageContentData";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { FaCheck, FaChevronDown } from "react-icons/fa6";
import { format, parse } from "date-fns";
import {
  fetchGroups,
  pickGroupTitle,
} from "@/components/routes/groups/api/groupsApi";

interface VerseOfDayFormProps {
  mode: "create" | "edit";
  initialData?: VerseOfDayItem;
  onSuccess: () => void;
  onCancel: () => void;
  existingVerses: VerseOfDayItem[];
}

const emptyVerses = (codes: string[]): VerseContent =>
  Object.fromEntries(codes.map((code) => [code.toLowerCase(), ""]));

const VerseOfDayForm = ({
  mode,
  initialData,
  onSuccess,
  onCancel,
  existingVerses,
}: VerseOfDayFormProps) => {
  const { languageOptions, getLanguageLabel } = useLanguages();
  const languageCodes = languageOptions.map((l) => l.value);
  const [activeLanguage, setActiveLanguage] = useState<LanguageCode>("EN");
  const [verses, setVerses] = useState<VerseContent>(() =>
    emptyVerses(["EN", "BO", "ZH", "HI", "NE", "MN"]),
  );
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    if (mode === "edit" && initialData) {
      const next = emptyVerses(
        languageCodes.length > 0
          ? languageCodes
          : Object.keys(initialData.verses ?? {}).map((c) => c.toUpperCase()),
      );
      for (const [key, value] of Object.entries(initialData.verses ?? {})) {
        next[key.toLowerCase()] = value || "";
      }
      setVerses(next);
      // Set image preview from existing data
      setImageKey(null);
      setImagePreview(initialData.image_url || null);
      // Use group_id directly from the response
      setGroupId(initialData.group_id || "");
      setSource(initialData.source || "");
      setDate(parse(initialData.date, "yyyy-MM-dd", new Date()));
    } else {
      setActiveLanguage("EN");
      setVerses(emptyVerses(languageCodes.length > 0 ? languageCodes : ["EN"]));
      setImageKey(null);
      setImagePreview(null);
      setGroupId("");
      setSource("");
      setDate(new Date());
    }
  }, [mode, initialData, languageCodes.join(",")]);

  const createMutation = useMutation({
    mutationFn: createVerseOfDay,
    onSuccess: () => {
      toast.success("Verse of Day created successfully!");
      onSuccess();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: VerseOfDayPayload }) =>
      updateVerseOfDay(id, payload),
    onSuccess: () => {
      toast.success("Verse of Day updated successfully!");
      onSuccess();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const handleImageUpload = async (file: File) => {
    setIsImageUploading(true);
    try {
      const { image, key } = await uploadImageToS3(file, "");
      setImagePreview(image.original);
      setImageKey(key);
      setIsImageDialogOpen(false);
      toast.success("Image uploaded successfully!");
    } catch (error: any) {
      if (error?.response?.status === 413) {
        toast.error("Failed to upload image", {
          description: "File exceeds the maximum size of 1MB",
        });
      } else {
        toast.error("Failed to upload image");
      }
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageKey(null);
    setImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!Object.values(verses).some((v) => v.trim())) {
      toast.error("At least one verse content is required");
      return;
    }

    if (!groupId.trim()) {
      toast.error("Please select a group");
      return;
    }

    if (!date) {
      toast.error("Date is required");
      return;
    }

    // Check for duplicate date (only when creating or changing date in edit mode)
    const selectedDate = format(date, "yyyy-MM-dd");
    const isDuplicateDate = existingVerses.some((verse) => {
      // When editing, exclude the current verse from the check
      if (mode === "edit" && initialData && verse.id === initialData.id) {
        return false;
      }
      return verse.date === selectedDate;
    });

    if (isDuplicateDate) {
      toast.error(
        `A verse already exists for ${format(date, "PPP")}. Please choose a different date.`,
      );
      return;
    }

    const trimmedVerses = Object.fromEntries(
      Object.entries(verses).map(([key, value]) => [key, value.trim()]),
    );
    const trimmedSource = source.trim() || null;

    // For create, send all required fields
    // For update, only send fields that have changed
    if (mode === "edit" && initialData) {
      const updatePayload: any = {
        verses: trimmedVerses,
      };

      // Only include date if it changed
      const newDate = format(date, "yyyy-MM-dd");
      if (newDate !== initialData.date) {
        updatePayload.date = newDate;
      }

      // Only include image_urls if user uploaded a new image
      if (imageKey) {
        updatePayload.image_urls = [imageKey];
      }

      // Only include group_id if it's a valid UUID
      const trimmedGroupId = String(groupId).trim();
      if (
        trimmedGroupId &&
        trimmedGroupId.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        )
      ) {
        updatePayload.group_id = trimmedGroupId;
      }

      const previousSource = initialData.source?.trim() || null;
      if (trimmedSource !== previousSource) {
        updatePayload.source = trimmedSource;
      }

      updateMutation.mutate({ id: initialData.id, payload: updatePayload });
    } else {
      const createPayload: any = {
        verses: trimmedVerses,
        image_urls: imageKey ? [imageKey] : [],
        group_id: groupId.trim() || null,
        date: format(date, "yyyy-MM-dd"),
        source: trimmedSource,
      };
      createMutation.mutate(createPayload);
    }
  };

  const handleVerseChange = (value: string) => {
    const key = activeLanguage.toLowerCase();
    setVerses({
      ...verses,
      [key]: value,
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <label className="text-sm font-bold">Verse Content</label>
        <div className="flex gap-2 border-b">
          {languageOptions.map((lang) => (
            <button
              key={lang.value}
              type="button"
              onClick={() => setActiveLanguage(lang.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeLanguage === lang.value
                  ? "border-b-2 border-[#A51C21] text-[#A51C21]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
        <Textarea
          value={verses[activeLanguage.toLowerCase()] ?? ""}
          onChange={(e) => handleVerseChange(e.target.value)}
          placeholder={`Enter verse content in ${getLanguageLabel(activeLanguage)}`}
          className="min-h-[120px] resize-none"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="verse-source" className="text-sm font-bold">
          Source / Reference
        </label>
        <Input
          id="verse-source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Dhp 1.5"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold">Image</label>
        <div className="flex gap-4 items-start">
          {!imagePreview && (
            <button
              type="button"
              onClick={() => setIsImageDialogOpen(true)}
              className="border w-32 h-24 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 transition-colors"
              aria-label="Upload verse image"
            >
              <IoMdAdd className="h-8 w-8 text-gray-400" />
            </button>
          )}
          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Verse preview"
                className="w-32 h-24 object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                aria-label="Remove image"
              >
                <IoMdClose className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <GroupSelectField groupId={groupId} setGroupId={setGroupId} />

      <div className="space-y-2">
        <label className="text-sm font-bold">Date</label>
        <Pecha.Popover open={showCalendar} onOpenChange={setShowCalendar}>
          <Pecha.PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left font-normal"
            >
              {date ? format(date, "PPP") : "Pick a date"}
            </Button>
          </Pecha.PopoverTrigger>
          <Pecha.PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(newDate) => {
                setDate(newDate);
                setShowCalendar(false);
              }}
              initialFocus
            />
          </Pecha.PopoverContent>
        </Pecha.Popover>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
          disabled={isPending}
        >
          {isPending
            ? mode === "edit"
              ? "Updating..."
              : "Creating..."
            : mode === "edit"
              ? "Update"
              : "Create"}
        </Button>
      </div>

      <Pecha.Dialog
        open={isImageDialogOpen}
        onOpenChange={setIsImageDialogOpen}
      >
        <Pecha.DialogContent showCloseButton>
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>Upload & Crop Image</Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <ImageContentData
            onUpload={handleImageUpload}
            isLoading={isImageUploading}
          />
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </form>
  );
};

export default VerseOfDayForm;

export { VerseOfDayForm };

interface GroupSelectFieldProps {
  groupId: string;
  setGroupId: (id: string) => void;
}

const GroupSelectField = ({ groupId, setGroupId }: GroupSelectFieldProps) => {
  const [open, setOpen] = useState(false);

  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["groups-list-for-verse"],
    queryFn: () => fetchGroups({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const groups = groupsData?.groups ?? [];
  const selectedGroup = groups.find((g) => g.id === groupId);

  return (
    <div className="space-y-2">
      <label className="text-sm font-bold">Group</label>
      <Pecha.Popover open={open} onOpenChange={setOpen}>
        <Pecha.PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {isLoadingGroups
              ? "Loading groups..."
              : selectedGroup
                ? pickGroupTitle(selectedGroup.metadata)
                : "Select a group..."}
            <FaChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </Pecha.PopoverTrigger>
        <Pecha.PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Pecha.Command>
            <Pecha.CommandInput placeholder="Search groups..." />
            <Pecha.CommandList>
              <Pecha.CommandEmpty>No groups found.</Pecha.CommandEmpty>
              <Pecha.CommandGroup>
                {groups.map((group) => (
                  <Pecha.CommandItem
                    key={group.id}
                    value={pickGroupTitle(group.metadata)}
                    onSelect={() => {
                      setGroupId(group.id);
                      setOpen(false);
                    }}
                  >
                    <FaCheck
                      className={`mr-2 h-4 w-4 ${
                        groupId === group.id ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    {pickGroupTitle(group.metadata)}
                  </Pecha.CommandItem>
                ))}
              </Pecha.CommandGroup>
            </Pecha.CommandList>
          </Pecha.Command>
        </Pecha.PopoverContent>
      </Pecha.Popover>
    </div>
  );
};
