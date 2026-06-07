import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_BIO_MAX_LENGTH,
  getCharacterCount,
} from "@/entities/user";

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
    <div className="mt-8 w-full space-y-5 text-left">
      <div className="space-y-2">
        <label
          htmlFor="name"
          className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          Display Name
        </label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={onFormChange}
          maxLength={PROFILE_NAME_MAX_LENGTH}
          className="bg-surface-lowest text-base font-medium tracking-[-0.02em]"
        />
        <div className="flex items-center justify-between font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
          <span>Up to {PROFILE_NAME_MAX_LENGTH} characters</span>
          <span>
            {getCharacterCount(formData.name)}/{PROFILE_NAME_MAX_LENGTH}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label
          htmlFor="bio"
          className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          Bio / About
        </label>
        <Textarea
          id="bio"
          name="bio"
          value={formData.bio}
          onChange={onFormChange}
          maxLength={PROFILE_BIO_MAX_LENGTH}
          className="min-h-32 w-full bg-surface-lowest leading-7"
          rows={3}
        />
        <div className="flex items-center justify-between font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
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
        >
          Cancel
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
