import { useState, useMemo, useEffect, useCallback } from "react";
import { useMutation } from "@apollo/client/react";
import { UpdateProfileDocument } from "@/graphql/generated/graphql";
import { useToast } from "@/hooks/use-toast";
import { useImageUpload } from "@/hooks/use-image-upload";
import {
  sanitizeProfileFormData,
  sanitizeProfileName,
  sanitizeProfileBioInput,
  buildProfileUpdatePayload,
  type EditableProfileFormData,
} from "@/lib/user-input";

export const useUserProfile = (currentUser: any) => {
  const { toast } = useToast();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditableProfileFormData>({
    name: "",
    bio: "",
  });

  const [updateProfile, { loading: isSaving }] = useMutation(UpdateProfileDocument);
  const { upload: uploadImage } = useImageUpload();

  const profileFormDefaults = useMemo<EditableProfileFormData>(
    () => sanitizeProfileFormData({
      name: currentUser?.name ?? "",
      bio: currentUser?.bio ?? "",
    }),
    [currentUser]
  );

  useEffect(() => {
    if (!currentUser || isEditingProfile) return;

    setFormData(profileFormDefaults);
    setAvatarPreview(currentUser.avatarUrl || null);
    setBannerPreview(currentUser.bannerUrl || null);
  }, [isEditingProfile, profileFormDefaults, currentUser]);

  const handleFileChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>,
    type: "avatar" | "banner"
  ) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (type === "avatar") setAvatarFile(file);
      else setBannerFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "avatar") setAvatarPreview(reader.result as string);
        else setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleFormChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    if (name !== "name" && name !== "bio") return;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "name" ? sanitizeProfileName(value) : sanitizeProfileBioInput(value),
    }));
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;

    const sanitizedFormData = sanitizeProfileFormData(formData);
    const updatePayload: any = buildProfileUpdatePayload(sanitizedFormData, profileFormDefaults);

    if (avatarFile) {
      const url = await uploadImage(avatarFile, { loadingTitle: "Uploading Avatar..." });
      if (!url) return;
      updatePayload.avatarUrl = url;
    }

    if (bannerFile) {
      const url = await uploadImage(bannerFile, { loadingTitle: "Uploading Banner..." });
      if (!url) return;
      updatePayload.bannerUrl = url;
    }

    if (Object.keys(updatePayload).length === 0) {
      toast({ title: "No Changes", description: "You haven't made any changes." });
      setIsEditingProfile(false);
      return;
    }

    try {
      const { data } = await updateProfile({ variables: updatePayload });
      if (data?.updateProfile) {
        setIsEditingProfile(false);
        setAvatarFile(null);
        setBannerFile(null);
        toast({ title: "Success", description: "Profile updated successfully." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
    }
  };

  const handleCancel = () => {
    setIsEditingProfile(false);
    setFormData(profileFormDefaults);
    setAvatarPreview(currentUser?.avatarUrl || null);
    setBannerPreview(currentUser?.bannerUrl || null);
    setAvatarFile(null);
    setBannerFile(null);
  };

  return {
    state: {
      isEditingProfile,
      avatarPreview,
      bannerPreview,
      formData,
      isSaving,
      avatarFile,
      bannerFile,
    },
    handlers: {
      setIsEditingProfile,
      handleFileChange,
      handleFormChange,
      handleSaveProfile,
      handleCancel,
    }
  };
};
