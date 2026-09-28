import axiosInstance from "@/config/axios-config";
import { Pecha } from "@/components/ui/shadimport";
import { Label } from "@/components/ui/atoms/label";
import { SOCIAL_PLATFORMS, PLATFORM_PATTERNS } from "@/lib/constant";
import { IoMdClose, IoMdAdd } from "react-icons/io";
import { FaEdit } from "react-icons/fa";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { profileSchema, type ProfileFormData } from "@/schema/ProfileSchema";
import { toast } from "sonner";
import ImageContentData from "@/components/ui/molecules/modals/image-upload/ImageContentData";
import { uploadImageToS3 } from "@/components/routes/task/api/taskApi";
import { USER_INFO_QUERY_KEY } from "@/hooks/useUserInfo";

import { getAccessToken } from "@/lib/auth-storage";
const getUrlError = (account: string, url: string): string | null => {
  if (!account || !url || account === "email") return null;
  const pattern = PLATFORM_PATTERNS[account];
  if (pattern && !pattern.test(url))
    return `URL must be a valid ${account} link`;
  return null;
};

interface SocialProfile {
  account: string;
  url: string;
}

interface ProfileEditFormProps {
  userInfo: any;
  onSuccess: () => void;
}

const updateUserProfile = async (
  profileData: ProfileFormData & { social_profiles?: SocialProfile[] },
) => {
  const accessToken = getAccessToken();
  const { data } = await axiosInstance.post(
    `/api/v1/authors/info`,
    profileData,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return data;
};

const ProfileEditForm = ({ userInfo, onSuccess }: ProfileEditFormProps) => {
  const queryClient = useQueryClient();

  const [isSocialDirty, setIsSocialDirty] = useState(false);
  const [socialProfiles, setSocialProfiles] = useState<SocialProfile[]>(() => {
    const existingProfiles = userInfo?.social_profiles || [];
    const hasEmail = existingProfiles.some(
      (sp: SocialProfile) =>
        sp.account === "email" && sp.url === userInfo?.email,
    );

    return [
      ...(userInfo?.email && !hasEmail
        ? [{ account: "email", url: userInfo.email }]
        : []),
      ...existingProfiles,
    ];
  });

  const [imagePreview, setImagePreview] = useState<string | null>(
    userInfo?.image?.medium || null,
  );

  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstname: userInfo.firstname || "",
      lastname: userInfo.lastname || "",
      bio: userInfo.bio || "",
      image_url: decodeURIComponent(userInfo?.image?.original) || "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (
      profileData: ProfileFormData & { social_profiles?: SocialProfile[] },
    ) => updateUserProfile(profileData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_INFO_QUERY_KEY });
      onSuccess();
      toast.success("Profile updated successfully!");
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  const handleImageUpload = async (file: File) => {
    setIsImageUploading(true);
    try {
      const data = await uploadImageToS3(file, "");
      const imageUrl = data.image.original;
      const imageKey = data.key;
      setImagePreview(imageUrl);
      form.setValue("image_url", imageKey, {
        shouldDirty: true,
        shouldTouch: true,
      });
      setIsImageDialogOpen(false);
      toast.success("Image uploaded successfully!");
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleAddSocialProfile = () => {
    if (socialProfiles.length < 7) {
      setSocialProfiles([{ account: "", url: "" }, ...socialProfiles]);
      setIsSocialDirty(false);
    }
  };

  const handleRemoveSocialProfile = (index: number) => {
    setSocialProfiles(socialProfiles.filter((_, i) => i !== index));
    setIsSocialDirty(true);
  };

  const handleSocialProfileChange = (
    index: number,
    field: "account" | "url",
    value: string,
  ) => {
    const updated = [...socialProfiles];
    updated[index][field] = value;
    setSocialProfiles(updated);
  };

  const onSubmit = (data: ProfileFormData) => {
    const hasUrlErrors = socialProfiles.some((sp) =>
      getUrlError(sp.account, sp.url),
    );
    if (hasUrlErrors) return;
    try {
      const validatedData = profileSchema.parse(data);
      const filteredSocialProfiles = socialProfiles.filter(
        (sp) => sp.account && sp.url,
      );

      updateProfileMutation.mutate({
        ...validatedData,
        ...(filteredSocialProfiles.length > 0 && {
          social_profiles: filteredSocialProfiles,
        }),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.issues[0].message);
      }
    }
  };

  return (
    <Pecha.Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex p-6 flex-col md:flex-row gap-4 justify-between"
      >
        <div className="gap-4 flex-1 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="image_key">Profile Picture</Label>
            <div>
              {!imagePreview ? (
                <div
                  onClick={() => {
                    setIsImageDialogOpen(true);
                  }}
                  className="border w-22 h-22 border-dashed border-gray-300 rounded-full  text-center hover:border-gray-400 transition-colors cursor-pointer focus:outline-none flex items-center justify-center"
                >
                  <IoMdAdd className="h-8 w-8 text-gray-400" />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full overflow-hidden relative">
                  <img
                    src={imagePreview}
                    alt="Profile"
                    className=" w-full h-full object-cover rounded-full border "
                  />
                  <div
                    className="absolute inset-0 bg-black/60 rounded-lg opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    onClick={() => setIsImageDialogOpen(true)}
                  >
                    <FaEdit className="text-white text-xl" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Pecha.FormField
            control={form.control}
            name="firstname"
            render={({ field }) => (
              <Pecha.FormItem>
                <Pecha.FormLabel>First Name *</Pecha.FormLabel>
                <Pecha.FormControl>
                  <Pecha.Input
                    type="text"
                    placeholder="Enter your first name"
                    {...field}
                  />
                </Pecha.FormControl>
                <Pecha.FormMessage />
              </Pecha.FormItem>
            )}
          />

          <Pecha.FormField
            control={form.control}
            name="lastname"
            render={({ field }) => (
              <Pecha.FormItem>
                <Pecha.FormLabel>Last Name *</Pecha.FormLabel>
                <Pecha.FormControl>
                  <Pecha.Input
                    type="text"
                    placeholder="Enter your last name"
                    {...field}
                  />
                </Pecha.FormControl>
                <Pecha.FormMessage />
              </Pecha.FormItem>
            )}
          />

          <Pecha.FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <Pecha.FormItem>
                <Pecha.FormLabel>Bio</Pecha.FormLabel>
                <Pecha.FormControl>
                  <Pecha.Textarea
                    placeholder="Tell us about yourself..."
                    rows={4}
                    {...field}
                  />
                </Pecha.FormControl>
                <Pecha.FormMessage />
              </Pecha.FormItem>
            )}
          />
        </div>

        <div className="flex-1">
          <div className="space-y-4 border border-dashed rounded-md p-4">
            <div className="flex justify-between items-center">
              <Label>Social Links (Max 7)</Label>
              <Pecha.Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSocialProfile}
                disabled={socialProfiles.length >= 7}
              >
                Add Social Link
              </Pecha.Button>
            </div>

            <div className=" h-[300px] overflow-y-auto space-y-4">
              {socialProfiles.map((social, index) => {
                const usedPlatforms = socialProfiles
                  .filter((_, i) => i !== index)
                  .map((sp) => sp.account)
                  .filter(Boolean);
                const urlError = getUrlError(social.account, social.url);

                return (
                  <div
                    key={index}
                    className="flex gap-3 items-start p-4 border rounded-md"
                  >
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <Label htmlFor={`social-platform-${index}`}>
                            Platform
                          </Label>
                          <Pecha.Select
                            value={social.account}
                            onValueChange={(value) =>
                              handleSocialProfileChange(index, "account", value)
                            }
                            disabled={
                              social.account === "email" &&
                              social.url === userInfo?.email
                            }
                          >
                            <Pecha.SelectTrigger
                              id={`social-platform-${index}`}
                            >
                              <Pecha.SelectValue placeholder="Select platform" />
                            </Pecha.SelectTrigger>
                            <Pecha.SelectContent>
                              <Pecha.SelectGroup>
                                {SOCIAL_PLATFORMS.map((platform) => {
                                  const isDisabled = usedPlatforms.includes(
                                    platform.value,
                                  );
                                  return (
                                    <Pecha.SelectItem
                                      key={platform.value}
                                      value={platform.value}
                                      disabled={isDisabled}
                                    >
                                      {platform.value}
                                    </Pecha.SelectItem>
                                  );
                                })}
                              </Pecha.SelectGroup>
                            </Pecha.SelectContent>
                          </Pecha.Select>
                        </div>
                        <Pecha.Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveSocialProfile(index)}
                          disabled={
                            social.account === "email" &&
                            social.url === userInfo?.email
                          }
                        >
                          <IoMdClose className="w-4 h-4" />
                        </Pecha.Button>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`social-url-${index}`}>URL</Label>
                        <Pecha.Input
                          type="url"
                          id={`social-url-${index}`}
                          value={social.url}
                          onChange={(e) => {
                            handleSocialProfileChange(
                              index,
                              "url",
                              e.target.value,
                            );
                            setIsSocialDirty(true);
                          }}
                          placeholder="https://example.com/yourprofile"
                          disabled={
                            social.account === "email" &&
                            social.url === userInfo?.email
                          }
                        />
                        {urlError && (
                          <p className="text-sm text-red-500">{urlError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex mt-4 justify-end gap-3">
            <Pecha.Button
              type="submit"
              className=" h-12 px-12 font-medium dark:text-white  bg-[#A51C21] hover:bg-[#A51C21]/90"
              disabled={
                (!form.formState.isDirty && !isSocialDirty) ||
                updateProfileMutation.isPending ||
                socialProfiles.some((sp) => getUrlError(sp.account, sp.url))
              }
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Pecha.Button>
          </div>
        </div>

        <Pecha.Dialog
          open={isImageDialogOpen}
          onOpenChange={setIsImageDialogOpen}
        >
          <Pecha.DialogContent showCloseButton={true}>
            <Pecha.DialogHeader>
              <Pecha.DialogTitle>
                Upload & Crop Profile Picture
              </Pecha.DialogTitle>
            </Pecha.DialogHeader>
            <ImageContentData
              onUpload={handleImageUpload}
              isLoading={isImageUploading}
            />
          </Pecha.DialogContent>
        </Pecha.Dialog>
      </form>
    </Pecha.Form>
  );
};

export default ProfileEditForm;
