import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_BIO_MAX_LENGTH,
  getCharacterCount,
} from "@/lib/user-input";

interface ProfileEditFormProps {
  formData: { name: string; bio: string };
  isSaving: boolean;
  onFormChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  formData,
  isSaving,
  onFormChange,
  onSave,
  onCancel,
}) => {
  return (
    <div className="mt-8 w-full space-y-4 text-left">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-zinc-300">
          Display Name
        </label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={onFormChange}
          maxLength={PROFILE_NAME_MAX_LENGTH}
          className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500"
        />
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Up to {PROFILE_NAME_MAX_LENGTH} characters</span>
          <span>
            {getCharacterCount(formData.name)}/{PROFILE_NAME_MAX_LENGTH}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="bio" className="text-sm font-medium text-zinc-300">
          Bio / About
        </label>
        <Textarea
          id="bio"
          name="bio"
          value={formData.bio}
          onChange={onFormChange}
          maxLength={PROFILE_BIO_MAX_LENGTH}
          className="min-h-[100px] w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
          rows={3}
        />
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Up to {PROFILE_BIO_MAX_LENGTH} characters</span>
          <span>
            {getCharacterCount(formData.bio)}/{PROFILE_BIO_MAX_LENGTH}
          </span>
        </div>
      </div>
      <div className="flex flex-col justify-end gap-3 pt-2 sm:flex-row">
        <Button
          onClick={onCancel}
          variant="outline"
          className="border-zinc-700 text-zinc-300"
        >
          Cancel
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving}
          className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
