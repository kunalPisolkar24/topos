import React from "react";
import { Mail, FileText, Calendar } from "lucide-react";

interface ProfileViewInfoProps {
  displayName: string;
  email: string;
  bio: string | null | undefined;
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
  const joinedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const hasBio = Boolean(bio?.trim());

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="max-w-3xl space-y-4">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
          Profile // Identity
        </p>
        <h1 className="max-w-full break-words text-4xl font-semibold leading-none tracking-[-0.045em] text-foreground md:text-6xl">
          {displayName}
        </h1>
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 bg-primary-container px-3 py-2 text-primary-foreground">
            <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="break-all font-mono text-[0.6875rem] uppercase tracking-[0.12em]">
              {email}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.42fr)]">
        <div className="bg-surface-lowest p-4 ring-1 ring-outline-variant/20 sm:p-5">
          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            About
          </p>
          <p className="mt-3 max-h-48 max-w-2xl overflow-y-auto whitespace-pre-wrap break-words pr-2 text-sm leading-7 text-muted-foreground md:text-base">
            {hasBio ? bio : <span className="italic">No bio added yet.</span>}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
          <ProfileMetric
            icon={FileText}
            label="Published"
            value={totalPosts.toString()}
            detail={totalPosts === 1 ? "Post" : "Posts"}
          />
          <ProfileMetric
            icon={Calendar}
            label="Joined"
            value={joinedDate}
            detail="Member Since"
          />
        </div>
      </div>
    </div>
  );
};

interface ProfileMetricProps {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}

const ProfileMetric: React.FC<ProfileMetricProps> = ({
  icon: Icon,
  label,
  value,
  detail,
}) => (
  <div className="bg-surface-lowest p-4 ring-1 ring-outline-variant/20">
    <div className="flex items-center justify-between gap-3">
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
    </div>
    <p className="mt-3 break-words text-2xl font-semibold leading-none tracking-[-0.04em] text-foreground">
      {value}
    </p>
    <p className="mt-2 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground">
      {detail}
    </p>
  </div>
);
