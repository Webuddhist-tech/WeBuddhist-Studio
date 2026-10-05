import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useOutletContext } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Textarea } from "@/components/ui/atoms/textarea";
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
  languageLabelForCode,
  patchGroup,
  replaceGroupSocialLinks,
  replaceGroupTags,
  resolveGroupAvatarUrl,
  resolveGroupBannerUrl,
  type GroupSocialLinkDTO,
  type TagSummaryDTO,
} from "./api/groupsApi";
import { canEditGroupSettings } from "./lib/groupPermissions";
import { sameSocialLinks, sameSortedIds } from "./lib/groupFormSectionDirty";
import GroupFormAssociationsPanel from "./components/GroupFormAssociationsPanel";
import GroupImageField from "./components/GroupImageField";
import GroupTraditionField from "./components/GroupTraditionField";
import { traditionCodeForSave } from "./lib/groupTradition";
import type { GroupOutletContext } from "./GroupLayout";

type AssociationBaselines = {
  tagIds: string[];
  socialLinks: GroupSocialLinkDTO[];
  avatarKey: string | null;
  bannerKey: string | null;
};

const GroupAboutEditPage = () => {
  const { group, groupId, myRole, readOnlyPlatform } =
    useOutletContext<GroupOutletContext>();
  const queryClient = useQueryClient();
  const hydratedRef = useRef<string | null>(null);

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
  const [savedBaselines, setSavedBaselines] = useState<AssociationBaselines>({
    tagIds: [],
    socialLinks: [],
    avatarKey: null,
    bannerKey: null,
  });
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
    setAddedLanguages(langs.length ? langs : ["EN"]);
    form.reset({
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
    });

    setAvatarKey(group.avatar_key ?? null);
    setBannerKey(group.banner_key ?? null);
    setAvatarPreview(resolveGroupAvatarUrl(group));
    setBannerPreview(resolveGroupBannerUrl(group));
    setTagIds(group.tags.map((t) => t.id));
    setInitialTags(group.tags);
    setSocialLinks(group.social_links ?? []);
    setSavedBaselines({
      tagIds: group.tags.map((t) => t.id),
      socialLinks: group.social_links ?? [],
      avatarKey: group.avatar_key ?? null,
      bannerKey: group.banner_key ?? null,
    });
  }, [group, form]);

  const invalidateGroup = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-groups"] });
    queryClient.invalidateQueries({ queryKey: ["cms-group", groupId] });
  };

  const toastOnError = (err: unknown) => toast.error(getApiErrorMessage(err));

  const patchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof patchGroup>[1]) =>
      patchGroup(groupId, payload),
    onSuccess: () => {
      toast.success("Group updated");
      invalidateGroup();
      form.reset(form.getValues());
      setSavedBaselines((prev) => ({
        ...prev,
        avatarKey,
        bannerKey,
      }));
      hydratedRef.current = null;
    },
    onError: toastOnError,
  });

  const tagsMutation = useMutation({
    mutationFn: () => replaceGroupTags(groupId, { tag_ids: tagIds }),
    onSuccess: () => {
      toast.success("Tags saved");
      invalidateGroup();
      setSavedBaselines((prev) => ({ ...prev, tagIds: [...tagIds] }));
    },
    onError: toastOnError,
  });

  const socialMutation = useMutation({
    mutationFn: () =>
      replaceGroupSocialLinks(groupId, { social_links: socialLinks }),
    onSuccess: () => {
      toast.success("Social links saved");
      invalidateGroup();
      setSavedBaselines((prev) => ({
        ...prev,
        socialLinks: [...socialLinks],
      }));
    },
    onError: toastOnError,
  });

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
      toast.success("Image uploaded");
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const onSaveCore = form.handleSubmit((data) => {
    const metadata = buildGroupMetadata(data.languages);
    patchMutation.mutate({
      slug: data.slug.trim(),
      is_public: data.is_public,
      metadata,
      avatar_key: avatarKey,
      banner_key: bannerKey,
      tradition_code: traditionCodeForSave(data.tradition_code),
    });
  });

  const { isDirty: isFormDirty } = form.formState;
  const imagesDirty =
    avatarKey !== savedBaselines.avatarKey ||
    bannerKey !== savedBaselines.bannerKey;
  const isCoreDirty = isFormDirty || imagesDirty;
  const tagsDirty = !sameSortedIds(tagIds, savedBaselines.tagIds);
  const socialDirty = !sameSocialLinks(socialLinks, savedBaselines.socialLinks);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold">Edit about</h2>
        <Button variant="outline" size="sm" asChild>
          <Link to={ROUTES.group(groupId)}>Done</Link>
        </Button>
      </div>

      <div className="flex flex-col xl:flex-row xl:items-start gap-8 xl:gap-0">
        <div className="w-full xl:w-1/2 xl:min-w-0 xl:pr-8 xl:border-r border-border space-y-6">
          <section className="space-y-6">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
              General
            </h3>
            <Pecha.Form {...form}>
              <form onSubmit={onSaveCore} className="space-y-6">
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
                <div className="space-y-4">
                  {addedLanguages.map((code) => (
                    <div
                      key={code}
                      className="relative rounded-lg border border-input bg-[#FAFAFA] dark:bg-[#262626] p-4 space-y-3"
                    >
                      <button
                        type="button"
                        onClick={() => removeLanguage(code)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1"
                        aria-label={`Remove ${languageLabelForCode(code)}`}
                      >
                        <IoMdClose className="h-4 w-4" />
                      </button>
                      <Pecha.FormField
                        control={form.control}
                        name={`languages.${code}.title`}
                        render={({ field }) => (
                          <Pecha.FormItem>
                            <Pecha.FormLabel className="text-sm font-bold">
                              {languageLabelForCode(code)} title
                              <span className="text-destructive"> *</span>
                            </Pecha.FormLabel>
                            <Pecha.FormControl>
                              <Pecha.Input
                                className="h-12 bg-white dark:bg-[#181818]"
                                {...field}
                              />
                            </Pecha.FormControl>
                            <Pecha.FormMessage />
                          </Pecha.FormItem>
                        )}
                      />
                      <Pecha.FormField
                        control={form.control}
                        name={`languages.${code}.sub_title`}
                        render={({ field }) => (
                          <Pecha.FormItem>
                            <Pecha.FormLabel className="text-sm font-bold">
                              {languageLabelForCode(code)} sub-title
                              <span className="text-destructive"> *</span>
                            </Pecha.FormLabel>
                            <Pecha.FormControl>
                              <Pecha.Input
                                className="h-12 bg-white dark:bg-[#181818]"
                                {...field}
                              />
                            </Pecha.FormControl>
                            <Pecha.FormMessage />
                          </Pecha.FormItem>
                        )}
                      />
                      <Pecha.FormField
                        control={form.control}
                        name={`languages.${code}.description`}
                        render={({ field }) => (
                          <Pecha.FormItem>
                            <Pecha.FormLabel className="text-sm font-bold">
                              {languageLabelForCode(code)} description
                              <span className="text-destructive"> *</span>
                            </Pecha.FormLabel>
                            <Pecha.FormControl>
                              <Textarea
                                className="min-h-[100px] resize-none bg-white dark:bg-[#181818]"
                                maxLength={200}
                                {...field}
                              />
                            </Pecha.FormControl>
                            <Pecha.FormMessage />
                          </Pecha.FormItem>
                        )}
                      />
                      <Pecha.FormField
                        control={form.control}
                        name={`languages.${code}.description_long`}
                        render={({ field }) => (
                          <Pecha.FormItem>
                            <Pecha.FormLabel className="text-sm font-bold">
                              {languageLabelForCode(code)} long description
                            </Pecha.FormLabel>
                            <Pecha.FormControl>
                              <Textarea
                                className="min-h-[160px] resize-y bg-white dark:bg-[#181818]"
                                placeholder="A longer description with more detail…"
                                {...field}
                              />
                            </Pecha.FormControl>
                            <Pecha.FormMessage />
                          </Pecha.FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>
                {availableLanguages.length > 0 && (
                  <Pecha.Select
                    onValueChange={(v) => addLanguage(v as LanguageCode)}
                  >
                    <Pecha.SelectTrigger className="w-fit border-dashed bg-white dark:bg-[#262626]">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <IoMdAdd className="h-4 w-4" />
                        <Pecha.SelectValue placeholder="Add language" />
                      </div>
                    </Pecha.SelectTrigger>
                    <Pecha.SelectContent>
                      {availableLanguages.map((lang) => (
                        <Pecha.SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </Pecha.SelectItem>
                      ))}
                    </Pecha.SelectContent>
                  </Pecha.Select>
                )}
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
                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
                    disabled={patchMutation.isPending || !isCoreDirty}
                  >
                    {patchMutation.isPending ? "Saving…" : "Save general"}
                  </Button>
                </div>
              </form>
            </Pecha.Form>
          </section>
        </div>

        <GroupFormAssociationsPanel
          tagIds={tagIds}
          onTagIdsChange={setTagIds}
          initialTags={initialTags}
          socialLinks={socialLinks}
          onSocialLinksChange={setSocialLinks}
          onSaveTags={() => tagsMutation.mutate()}
          onSaveSocial={() => socialMutation.mutate()}
          tagsSaving={tagsMutation.isPending}
          socialSaving={socialMutation.isPending}
          tagsSaveDisabled={!tagsDirty}
          socialSaveDisabled={!socialDirty}
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
