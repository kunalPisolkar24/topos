import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { userRepository } from "@/entities/user/api/userRepository";
import { postRepository } from "@/entities/post/api/postRepository";
import { useToast } from "@/shared/ui/hooks/useToast";
import { useImageUpload } from "@/entities/upload";
import { isPreview, PREVIEW_DISABLED_REASON } from "@/shared/config/preview";
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

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const isImageFile = (file: File): boolean => file.type.startsWith("image/");

const validateImageFile = (
  file: File,
  toast: ReturnType<typeof useToast>["toast"],
): boolean => {
  if (!isImageFile(file)) {
    toast({
      title: "Invalid file type",
      description: "Please select an image file.",
      variant: "destructive",
    });
    return false;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    toast({
      title: "File too large",
      description: "Image must be smaller than 10MB.",
      variant: "destructive",
    });
    return false;
  }
  return true;
};

export const useProfileEditorController = ({
  currentUser,
}: UseProfileEditorControllerProps) => {
  const { toast } = useToast();
  const client = useApolloClient();
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

  const [updateProfile, { loading: isSaving }] = userRepository.useUpdateProfile();
  const { upload: uploadImage } = useImageUpload();

  const avatarReaderRef = useRef<FileReader | null>(null);
  const bannerReaderRef = useRef<FileReader | null>(null);

  useEffect(() => {
    return () => {
      for (const ref of [avatarReaderRef, bannerReaderRef]) {
        if (ref.current && ref.current.readyState === FileReader.LOADING) {
          ref.current.abort();
        }
      }
    };
  }, []);

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
      if (isPreview()) {
        toast({ title: PREVIEW_DISABLED_REASON, variant: "destructive" });
        return;
      }
      const file = event.target.files?.[0];
      if (!file) return;
      if (!validateImageFile(file, toast)) return;
      const readerRef = type === "avatar" ? avatarReaderRef : bannerReaderRef;
      if (readerRef.current && readerRef.current.readyState === FileReader.LOADING) {
        readerRef.current.abort();
      }
      if (type === "avatar") {
        setAvatarFile(file);
      } else {
        setBannerFile(file);
      }

      const reader = new FileReader();
      readerRef.current = reader;
      reader.onloadend = () => {
        const result =
          typeof reader.result === "string" ? reader.result : null;
        if (type === "avatar") {
          setAvatarPreview(result);
        } else {
          setBannerPreview(result);
        }
      };
      reader.onerror = () => {
        toast({
          title: "Preview failed",
          description: "Failed to read image file.",
          variant: "destructive",
        });
      };
      reader.onabort = () => {
        toast({
          title: "Preview aborted",
          description: "Image preview was cancelled.",
          variant: "destructive",
        });
      };
      reader.readAsDataURL(file);
    },
    [toast],
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
        // Post lists embed author name/avatar/bio — revalidate them too.
        await postRepository.refreshLists(client);
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
