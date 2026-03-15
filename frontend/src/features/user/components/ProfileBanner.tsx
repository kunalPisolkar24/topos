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
    <div className="relative h-48 w-full bg-zinc-900 sm:h-64">
      <div
        className="absolute inset-0 h-full w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${bannerUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />

      {isEditing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <label
            htmlFor="bannerUpload"
            className="group flex cursor-pointer flex-col items-center text-zinc-300 transition-colors hover:text-white"
          >
            <div className="rounded-full border border-zinc-700 bg-zinc-900/50 p-3 transition-all group-hover:bg-zinc-900/80">
              <Camera className="h-6 w-6" />
            </div>
            <span className="mt-2 text-sm font-medium">Change Banner</span>
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
