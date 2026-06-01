import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { UpdateProfileDocument } from "@/shared/graphql/generated/graphql";
import { useToast } from "@/hooks/use-toast";
import { useImageUpload } from "@/entities/upload";
import {
  buildProfileUpdatePayload,
  sanitizeProfileBioInput,
  sanitizeProfileFormData,
  sanitizeProfileName,
  type EditableProfileFormData,
  type ProfileUpdatePayload,
} from "@/entities/user";
import type { UserCoreFragment } from "@/shared/graphql/generated/graphql";

type AvatarOrBanner = "avatar" | "banner";

interface ProfileEditorUpdatePayload extends ProfileUpdatePayload {
  avatarUrl?: string;
  bannerUrl?: string;
}

export interface ProfileEditorState {
  isEditingProfile: boolean;
  avatarPreview: string | null;
  bannerPreview: string | null;
  formData: EditableProfileFormData;
  isSaving: boolean;
  avatarFile: File | null;
  bannerFile: File | null;
  displayName: string;
  profileInitial: string;
  avatarSrc: string | null;
  bannerSrc: string | null;
  hasUnsavedProfileChanges: boolean;
}

export interface ProfileEditorHandlers {
  setIsEditingProfile: (value: boolean) => void;
  handleFileChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    type: AvatarOrBanner,
  ) => void;
  handleFormChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  handleSaveProfile: () => Promise<void>;
  handleCancel: () => void;
}

export interface UseProfileEditorControllerProps {
  currentUser: UserCoreFragment | null | undefined;
}

export const useProfileEditorController = ({
  currentUser,
}: UseProfileEditorControllerProps) => {
  const { toast } = useToast();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    currentUser?.avatarUrl ?? null,
  );
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    currentUser?.bannerUrl ?? null,
  );
  const [formData, setFormData] = useState<EditableProfileFormData>({
    name: "",
    bio: "",
  });

  const [updateProfile, { loading: isSaving }] = useMutation(
    UpdateProfileDocument,
  );
  const { upload: uploadImage } = useImageUpload();

  const profileFormDefaults = useMemo<EditableProfileFormData>(
    () =>
      sanitizeProfileFormData({
        name: currentUser?.name ?? "",
        bio: currentUser?.bio ?? "",
      }),
    [currentUser],
  );

  useEffect(() => {
    if (!currentUser || isEditingProfile) return;

    setFormData(profileFormDefaults);
    setAvatarPreview(currentUser.avatarUrl ?? null);
    setBannerPreview(currentUser.bannerUrl ?? null);
  }, [currentUser, isEditingProfile, profileFormDefaults]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, type: AvatarOrBanner) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (type === "avatar") {
        setAvatarFile(file);
      } else {
        setBannerFile(file);
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result =
          typeof reader.result === "string" ? reader.result : null;
        if (type === "avatar") {
          setAvatarPreview(result);
        } else {
          setBannerPreview(result);
        }
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const handleFormChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    if (name !== "name" && name !== "bio") return;

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "name"
          ? sanitizeProfileName(value)
          : sanitizeProfileBioInput(value),
    }));
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;

    const sanitizedFormData = sanitizeProfileFormData(formData);
    const updatePayload: ProfileEditorUpdatePayload = {
      ...buildProfileUpdatePayload(sanitizedFormData, profileFormDefaults),
    };

    if (avatarFile) {
      const url = await uploadImage(avatarFile, {
        loadingTitle: "Uploading Avatar...",
      });
      if (!url) return;
      updatePayload.avatarUrl = url;
    }

    if (bannerFile) {
      const url = await uploadImage(bannerFile, {
        loadingTitle: "Uploading Banner...",
      });
      if (!url) return;
      updatePayload.bannerUrl = url;
    }

    if (Object.keys(updatePayload).length === 0) {
      toast({
        title: "No Changes",
        description: "You haven't made any changes.",
      });
      setIsEditingProfile(false);
      return;
    }

    try {
      const { data } = await updateProfile({ variables: updatePayload });
      if (data?.updateProfile) {
        setIsEditingProfile(false);
        setAvatarFile(null);
        setBannerFile(null);
        toast({
          title: "Success",
          description: "Profile updated successfully.",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save profile.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setIsEditingProfile(false);
    setFormData(profileFormDefaults);
    setAvatarPreview(currentUser?.avatarUrl ?? null);
    setBannerPreview(currentUser?.bannerUrl ?? null);
    setAvatarFile(null);
    setBannerFile(null);
  };

  const displayName =
    currentUser?.name ||
    currentUser?.username ||
    "Workspace member";
  const profileInitial = (
    currentUser?.name?.charAt(0) ??
    currentUser?.username?.charAt(0) ??
    currentUser?.email?.charAt(0) ??
    "U"
  ).toUpperCase();
  const avatarSrc = avatarPreview ?? currentUser?.avatarUrl ?? null;
  const bannerSrc = bannerPreview ?? currentUser?.bannerUrl ?? null;
  const hasUnsavedProfileChanges =
    avatarFile !== null || bannerFile !== null;

  return {
    state: {
      isEditingProfile,
      avatarPreview,
      bannerPreview,
      formData,
      isSaving,
      avatarFile,
      bannerFile,
      displayName,
      profileInitial,
      avatarSrc,
      bannerSrc,
      hasUnsavedProfileChanges,
    },
    handlers: {
      setIsEditingProfile,
      handleFileChange,
      handleFormChange,
      handleSaveProfile,
      handleCancel,
    },
  };
};
