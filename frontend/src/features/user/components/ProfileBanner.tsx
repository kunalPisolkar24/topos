import React from "react";
import { Camera } from "lucide-react";

interface ProfileBannerProps {
  bannerUrl: string;
  isEditing: boolean;
  onBannerChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ProfileBanner: React.FC<ProfileBannerProps> = ({
  bannerUrl,
  isEditing,
  onBannerChange,
}) => {
  return (
    <div className="relative h-[17rem] w-full overflow-hidden bg-surface-low sm:h-[21rem]">
      <div
        className="absolute inset-0 h-full w-full bg-cover bg-center opacity-80 saturate-[0.72]"
        style={{ backgroundImage: `url(${bannerUrl})` }}
      />

      {isEditing && (
        <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm" />
      )}

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(var(--surface))_0%,rgb(var(--surface)/0.86)_34%,rgb(var(--surface)/0.34)_72%,rgb(var(--surface))_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_20%,rgb(var(--primary-container)/0.52),transparent_32%)]" />
      <div
        className="absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,rgb(var(--outline-variant)/0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--outline-variant)/0.12)_1px,transparent_1px)] [background-size:5rem_5rem]"
        aria-hidden="true"
      />
      <div className="container relative mx-auto flex h-full items-end px-4 pb-28 sm:px-6 lg:px-8">
        <div className="max-w-6xl">
          <div className="bg-surface-lowest/80 px-4 py-3 ring-1 ring-outline-variant/20 backdrop-blur-sm">
            <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.24em] text-primary">
              Topos Profile
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              Author identity, publication history, and editorial presence.
            </p>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-center px-4 py-4">
          <label
            htmlFor="bannerUpload"
            className="interactive-hover-primary flex cursor-pointer items-center gap-3 border border-outline-variant/20 bg-surface-lowest px-4 py-2 text-foreground"
          >
            <div className="flex h-8 w-8 items-center justify-center bg-primary-container text-primary-foreground">
              <Camera className="h-4 w-4" />
            </div>
            <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em]">
              Change Banner
            </span>
            <input
              id="bannerUpload"
              type="file"
              accept="image/*"
              onChange={onBannerChange}
              className="hidden"
            />
          </label>
        </div>
      )}
    </div>
  );
};
