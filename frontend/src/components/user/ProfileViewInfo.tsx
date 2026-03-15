import React from "react";
import { Mail, FileText, Calendar } from "lucide-react";

interface ProfileViewInfoProps {
  displayName: string;
  email: string;
  bio: string | null;
  totalPosts: number;
  createdAt: string;
}

export const ProfileViewInfo: React.FC<ProfileViewInfoProps> = ({
  displayName,
  email,
  bio,
  totalPosts,
  createdAt,
}) => {
  return (
    <div className="mt-4 w-full min-w-0 sm:ml-6">
      <div className="space-y-2">
        <h1 className="max-w-full break-words text-3xl font-bold text-zinc-100 [overflow-wrap:anywhere] md:text-4xl">
          {displayName}
        </h1>
        <div className="flex w-full flex-wrap items-center justify-center gap-2 text-zinc-400 sm:justify-start">
          <Mail className="h-4 w-4" />
          <p className="break-all">{email}</p>
        </div>
        <p className="max-h-48 max-w-2xl overflow-y-auto whitespace-pre-wrap break-words pt-2 pr-2 text-sm leading-relaxed text-zinc-400 [overflow-wrap:anywhere] md:text-base">
          {bio || <span className="italic">No bio added yet.</span>}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 sm:justify-start">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <FileText className="h-4 w-4 text-zinc-400" />
            <b>{totalPosts}</b> Posts
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Calendar className="h-4 w-4 text-zinc-400" />
            Joined{" "}
            <b className="font-normal">
              {new Date(createdAt).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </b>
          </div>
        </div>
      </div>
    </div>
  );
};
