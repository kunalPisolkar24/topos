import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { Input } from "@/shared/ui/primitives/input";
import { Textarea } from "@/shared/ui/primitives/textarea";
import {
  PROFILE_NAME_MAX_LENGTH,
  PROFILE_BIO_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  getCharacterCount,
} from "@/entities/user";

interface ProfileEditFormProps {
  formData: { username: string; name: string; bio: string };
  fieldErrors?: { username?: string };
  isSaving: boolean;
  onFormChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  formData,
  fieldErrors,
  isSaving,
  onFormChange,
  onSave,
  onCancel,
}) => {
  return (
    <div className="mt-8 w-full space-y-5 text-left">
      <div className="space-y-2">
        <label
          htmlFor="username"
          className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          Username
        </label>
        <Input
          id="username"
          name="username"
          value={formData.username}
          onChange={onFormChange}
          maxLength={USERNAME_MAX_LENGTH}
          aria-invalid={Boolean(fieldErrors?.username)}
          aria-describedby={fieldErrors?.username ? "username-error" : undefined}
          className="bg-surface-lowest font-mono text-base tracking-[-0.02em]"
        />
        {fieldErrors?.username ? (
          <p id="username-error" role="alert" className="text-xs leading-5 text-destructive">
            {fieldErrors.username}
          </p>
        ) : null}
        <div className="flex items-center justify-between font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
          <span>3-30 lowercase letters, digits, underscores</span>
          <span>
            {getCharacterCount(formData.username)}/{USERNAME_MAX_LENGTH}
          </span>
        </div>
      </div>
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
