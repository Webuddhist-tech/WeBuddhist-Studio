import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useOutletContext } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import ImageContentData from "@/components/ui/molecules/modals/image-upload/ImageContentData";
import { uploadImageToS3 } from "@/components/routes/task/api/taskApi";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useLanguages } from "@/hooks/useLanguages";
import { ROUTES } from "@/routes/paths";
import type { LanguageCode } from "@/schema/SeriesSchema";
import { groupCoreSchema, type GroupCoreFormData } from "@/schema/GroupSchema";
import {
  buildGroupMetadata,
  patchGroup,
  replaceGroupSocialLinks,
  replaceGroupTags,
  resolveGroupAvatarUrl,
  resolveGroupBannerUrl,
  type GroupSocialLinkDTO,
  type TagSummaryDTO,
} from "./api/groupsApi";
import { canEditGroupSettings } from "./lib/groupPermissions";
import GroupFormAssociationsPanel from "./components/GroupFormAssociationsPanel";
import GroupImageField from "./components/GroupImageField";
import GroupLanguageTabs from "./components/GroupLanguageTabs";
import GroupTraditionField from "./components/GroupTraditionField";
import { hasIncompleteSocialLink } from "./lib/groupSocialLinks";
import { traditionCodeUpdate } from "./lib/groupTradition";
import { useAutosave } from "./hooks/useAutosave";
import type { GroupOutletContext } from "./GroupLayout";

const SAVE_TOAST_ID = "group-about-autosave";

type CoreSnapshot = {
  slug: string;
  is_public: boolean;
  tradition_code: string;
  languages: GroupCoreFormData["languages"];
  avatarKey: string | null;
  bannerKey: string | null;
};

/** The saved shape of the general fields, with a fixed key order so two
 * snapshots of the same data serialize identically. */
const toCoreSnapshot = (
  values: GroupCoreFormData,
  languageCodes: LanguageCode[],
  avatarKey: string | null,
  bannerKey: string | null,
): CoreSnapshot => {
  const languages: GroupCoreFormData["languages"] = {};
  for (const code of languageCodes) {
    const lang = values.languages?.[code];
    languages[code] = {
      title: lang?.title ?? "",
      sub_title: lang?.sub_title ?? "",
      description: lang?.description ?? "",
      description_long: lang?.description_long ?? "",
    };
  }
  return {
    slug: values.slug ?? "",
    is_public: Boolean(values.is_public),
    tradition_code: values.tradition_code ?? "",
    languages,
    avatarKey,
    bannerKey,
  };
};

const GroupAboutEditPage = () => {
  const { group, groupId, myRole, readOnlyPlatform } =
    useOutletContext<GroupOutletContext>();
  const queryClient = useQueryClient();
  const hydratedRef = useRef<string | null>(null);
  /** The tradition last saved, so a save only sends it when it changed. */
  const savedTraditionRef = useRef("");

  const canEdit = !readOnlyPlatform && canEditGroupSettings(myRole);

  const [addedLanguages, setAddedLanguages] = useState<LanguageCode[]>(["EN"]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [bannerKey, setBannerKey] = useState<string | null>(null);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [initialTags, setInitialTags] = useState<TagSummaryDTO[]>([]);
  const [socialLinks, setSocialLinks] = useState<GroupSocialLinkDTO[]>([]);
  const { languageOptions } = useLanguages();

  const form = useForm<GroupCoreFormData>({
    resolver: zodResolver(groupCoreSchema),
    defaultValues: {
      slug: "",
      group_type: "PAGE",
      is_public: true,
      languages: {
        EN: { title: "", sub_title: "", description: "", description_long: "" },
      },
      avatar_key: "",
      banner_key: "",
      tradition_code: "",
    },
  });

  const invalidateGroup = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-groups"] });
    queryClient.invalidateQueries({ queryKey: ["cms-group", groupId] });
  };

  /** Runs one save, reporting the outcome in a single shared toast. Rethrows
   * failures so the autosave offers a retry. */
  const persist = async (request: () => Promise<unknown>) => {
    try {
      await request();
      toast.success("Changes saved", { id: SAVE_TOAST_ID });
      invalidateGroup();
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err), { id: SAVE_TOAST_ID });
      throw err;
    }
  };

  const coreAutosave = useAutosave({
    value: toCoreSnapshot(form.watch(), addedLanguages, avatarKey, bannerKey),
    enabled: canEdit,
    save: async (snapshot) => {
      // Invalid fields show their messages and wait for the next edit.
      if (!(await form.trigger())) return false;
      const saved = await persist(() =>
        patchGroup(groupId, {
          slug: snapshot.slug.trim(),
          is_public: snapshot.is_public,
          metadata: buildGroupMetadata(snapshot.languages),
          avatar_key: snapshot.avatarKey,
          banner_key: snapshot.bannerKey,
          ...traditionCodeUpdate(
            snapshot.tradition_code,
            savedTraditionRef.current,
          ),
        }),
      );
      savedTraditionRef.current = snapshot.tradition_code;
      return saved;
    },
  });

  const tagsAutosave = useAutosave({
    value: tagIds,
    enabled: canEdit,
    save: (ids) => persist(() => replaceGroupTags(groupId, { tag_ids: ids })),
  });

  const socialAutosave = useAutosave({
    value: socialLinks,
    enabled: canEdit,
    save: async (links) => {
      // A link still being typed is flagged inline; save once it is complete.
      if (hasIncompleteSocialLink(links)) return false;
      return persist(() =>
        replaceGroupSocialLinks(groupId, {
          social_links: links.map((l) => ({ ...l, url: l.url.trim() })),
        }),
      );
    },
  });

  const { markSaved: markCoreSaved } = coreAutosave;
  const { markSaved: markTagsSaved } = tagsAutosave;
  const { markSaved: markSocialSaved } = socialAutosave;

  useEffect(() => {
    if (hydratedRef.current === group.id) return;
    hydratedRef.current = group.id;

    const languages: GroupCoreFormData["languages"] = {};
    const langs: LanguageCode[] = [];
    for (const meta of group.metadata) {
      const code = meta.language as LanguageCode;
      langs.push(code);
      languages[code] = {
        title: meta.title ?? "",
        sub_title: meta.sub_title ?? "",
        description: meta.description ?? "",
        description_long: meta.description_long ?? "",
      };
    }
    const languageCodes: LanguageCode[] = langs.length ? langs : ["EN"];
    const values: GroupCoreFormData = {
      slug: group.slug,
      group_type: group.group_type ?? "PAGE",
      is_public: group.is_public,
      languages:
        langs.length > 0
          ? languages
          : {
              EN: {
                title: "",
                sub_title: "",
                description: "",
                description_long: "",
              },
            },
      avatar_key: group.avatar_key ?? "",
      banner_key: group.banner_key ?? "",
      tradition_code: group.tradition?.code ?? "",
    };
    const groupTagIds = group.tags.map((t) => t.id);
    const groupSocialLinks = group.social_links ?? [];

    setAddedLanguages(languageCodes);
    form.reset(values);
    savedTraditionRef.current = values.tradition_code ?? "";
    setAvatarKey(group.avatar_key ?? null);
    setBannerKey(group.banner_key ?? null);
    setAvatarPreview(resolveGroupAvatarUrl(group));
    setBannerPreview(resolveGroupBannerUrl(group));
    setTagIds(groupTagIds);
    setInitialTags(group.tags);
    setSocialLinks(groupSocialLinks);

    // Loaded values are already on the server, so they must not autosave.
    markCoreSaved(
      toCoreSnapshot(
        values,
        languageCodes,
        group.avatar_key ?? null,
        group.banner_key ?? null,
      ),
    );
    markTagsSaved(groupTagIds);
    markSocialSaved(groupSocialLinks);
  }, [group, form, markCoreSaved, markTagsSaved, markSocialSaved]);

  if (!canEdit) {
    return <Navigate to={ROUTES.group(groupId)} replace />;
  }

  const availableLanguages = languageOptions.filter(
    (l) => !addedLanguages.includes(l.value),
  );

  const addLanguage = (code: LanguageCode) => {
    if (addedLanguages.includes(code)) return;
    setAddedLanguages((prev) => [...prev, code]);
    form.setValue(
      `languages.${code}`,
      { title: "", sub_title: "", description: "", description_long: "" },
      { shouldDirty: true },
    );
  };

  const removeLanguage = (code: LanguageCode) => {
    if (addedLanguages.length <= 1) {
      toast.error("At least one language is required");
      return;
    }
    setAddedLanguages((prev) => prev.filter((c) => c !== code));
    form.unregister(`languages.${code}`);
  };

  const handleImageUpload = async (file: File, kind: "avatar" | "banner") => {
    const setUploading =
      kind === "avatar" ? setAvatarUploading : setBannerUploading;
    const setPreview = kind === "avatar" ? setAvatarPreview : setBannerPreview;
    const setKey = kind === "avatar" ? setAvatarKey : setBannerKey;
    const setDialog =
      kind === "avatar" ? setAvatarDialogOpen : setBannerDialogOpen;
    const field = kind === "avatar" ? "avatar_key" : "banner_key";

    setUploading(true);
    try {
      const { image, key } = await uploadImageToS3(file, groupId);
      setPreview(image.original);
      setKey(key);
      form.setValue(field, key, { shouldDirty: true });
      setDialog(false);
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const autosaves = [coreAutosave, tagsAutosave, socialAutosave];
  const isSaving = autosaves.some((a) => a.isSaving);
  const hasError = autosaves.some((a) => a.hasError);
  const hasUnsaved = autosaves.some((a) => a.isDirty);

  const retryFailedSaves = () => {
    for (const autosave of autosaves) {
      if (autosave.hasError) autosave.retry();
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold">Edit about</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {isSaving
              ? "Saving…"
              : hasError
                ? "Couldn't save changes"
                : hasUnsaved
                  ? "Unsaved changes"
                  : "All changes saved"}
          </span>
          {hasError && !isSaving && (
            <Button variant="outline" size="sm" onClick={retryFailedSaves}>
              Retry
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.group(groupId)}>Done</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-start gap-8 xl:gap-0">
        <div className="w-full xl:w-1/2 xl:min-w-0 xl:pr-8 xl:border-r border-border space-y-6">
          <section className="space-y-6">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
              General
            </h3>
            <Pecha.Form {...form}>
              <div className="space-y-6">
                <Pecha.FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <Pecha.FormItem>
                      <Pecha.FormLabel className="text-sm font-bold">
                        Slug
                        <span className="text-destructive"> *</span>
                      </Pecha.FormLabel>
                      <Pecha.FormControl>
                        <Pecha.Input
                          placeholder="bodhichitta-authors"
                          className="font-mono h-12 bg-white dark:bg-[#262626]"
                          {...field}
                        />
                      </Pecha.FormControl>
                      <Pecha.FormMessage />
                    </Pecha.FormItem>
                  )}
                />
                <Pecha.FormField
                  control={form.control}
                  name="is_public"
                  render={({ field }) => (
                    <Pecha.FormItem className="flex items-center gap-3">
                      <Pecha.FormControl>
                        <Pecha.Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(checked === true)
                          }
                        />
                      </Pecha.FormControl>
                      <Pecha.FormLabel className="text-sm font-bold !mt-0">
                        Public group
                      </Pecha.FormLabel>
                    </Pecha.FormItem>
                  )}
                />
                <GroupTraditionField
                  form={form}
                  currentTradition={group.tradition}
                />
                <GroupLanguageTabs
                  form={form}
                  languages={addedLanguages}
                  availableLanguages={availableLanguages}
                  onAddLanguage={addLanguage}
                  onRemoveLanguage={removeLanguage}
                />
                <div className="grid sm:grid-cols-2 gap-6">
                  <GroupImageField
                    label="Avatar"
                    displayUrl={avatarPreview}
                    hasStoredImage={Boolean(avatarKey)}
                    onUploadClick={() => setAvatarDialogOpen(true)}
                    imageClassName="w-20 h-20 rounded-full object-cover border"
                  />
                  <GroupImageField
                    label="Banner"
                    displayUrl={bannerPreview}
                    hasStoredImage={Boolean(bannerKey)}
                    onUploadClick={() => setBannerDialogOpen(true)}
                    imageClassName="w-full max-w-xs h-24 rounded object-cover border"
                  />
                </div>
              </div>
            </Pecha.Form>
          </section>
        </div>

        <GroupFormAssociationsPanel
          tagIds={tagIds}
          onTagIdsChange={setTagIds}
          initialTags={initialTags}
          socialLinks={socialLinks}
          onSocialLinksChange={setSocialLinks}
        />
      </div>

      <Pecha.Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <Pecha.DialogContent>
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>Upload avatar</Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <ImageContentData
            onUpload={(file) => handleImageUpload(file, "avatar")}
            isLoading={avatarUploading}
          />
        </Pecha.DialogContent>
      </Pecha.Dialog>

      <Pecha.Dialog open={bannerDialogOpen} onOpenChange={setBannerDialogOpen}>
        <Pecha.DialogContent>
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>Upload banner</Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <ImageContentData
            onUpload={(file) => handleImageUpload(file, "banner")}
            isLoading={bannerUploading}
          />
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </>
  );
};

export default GroupAboutEditPage;
