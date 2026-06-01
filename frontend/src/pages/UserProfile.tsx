"use client";

import React from "react";
import { Camera, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/entities/session";
import { StickyNavbar } from "@/widgets";
import {
  useProfileEditorController,
  useUserPosts,
  ProfileBanner,
  ProfileViewInfo,
  ProfileEditForm,
  ProfilePostsSection,
} from "@/features/user";

const DEFAULT_BANNER_URL = "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&q=80&w=1974";

const UserProfile: React.FC = () => {
  const { user: currentUser, loading: isUserLoading } = useCurrentUser();
  
  const { state: profileState, handlers: profileHandlers } = useProfileEditorController({
    currentUser,
  });
  const {
    blogs: userBlogs,
    loading: isPostsLoading,
    currentPage,
    totalPages,
    totalPosts,
    handlePageChange,
  } = useUserPosts(currentUser?.id);

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-surface text-foreground">
        <StickyNavbar />
        <div className="pt-app-navbar">
          <Skeleton className="h-[17rem] w-full rounded-none bg-surface-low sm:h-[21rem]" />
        </div>
        <main className="container mx-auto px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Card className="relative -mt-24 gap-0 bg-surface-low py-0">
              <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(240px,0.38fr)_minmax(0,1fr)]">
                <div className="bg-surface-lowest p-5 sm:p-6 lg:p-8">
                  <Skeleton className="h-3 w-28 rounded-none bg-primary/35" />
                  <Skeleton className="mt-6 aspect-square w-32 rounded-none bg-surface-low md:w-40" />
                  <div className="mt-6 grid gap-2">
                    <Skeleton className="h-16 rounded-none bg-surface-low" />
                    <Skeleton className="h-16 rounded-none bg-surface-low" />
                  </div>
                </div>
                <div className="space-y-6 p-5 sm:p-8 lg:p-10">
                  <Skeleton className="h-3 w-36 rounded-none bg-primary/35" />
                  <Skeleton className="h-12 w-3/4 rounded-none bg-surface-lowest" />
                  <Skeleton className="h-10 w-full max-w-xl rounded-none bg-surface-lowest" />
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.42fr)]">
                    <Skeleton className="h-40 rounded-none bg-surface-lowest" />
                    <div className="grid gap-3">
                      <Skeleton className="h-[4.5rem] rounded-none bg-surface-lowest" />
                      <Skeleton className="h-[4.5rem] rounded-none bg-surface-lowest" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="mt-10 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="bg-surface-low p-4 ring-1 ring-outline-variant/20">
                <Skeleton className="h-3 w-28 rounded-none bg-primary/35" />
                <Skeleton className="mt-4 h-8 w-40 rounded-none bg-surface-lowest" />
              </div>
              <div className="grid gap-5">
                <Skeleton className="h-[280px] rounded-none bg-surface-lowest" />
                <Skeleton className="h-[280px] rounded-none bg-surface-lowest" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!currentUser) return null;

  const bannerSrc = profileState.bannerPreview || currentUser.bannerUrl || DEFAULT_BANNER_URL;
  const displayName = currentUser.name || currentUser.username;
  const profileInitial = displayName.charAt(0).toUpperCase();
  const avatarSrc = profileState.avatarPreview || currentUser.avatarUrl || undefined;

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <StickyNavbar />

      <div className="pt-app-navbar">
        <ProfileBanner
          bannerUrl={bannerSrc}
          isEditing={profileState.isEditingProfile}
          onBannerChange={(e) => profileHandlers.handleFileChange(e, "banner")}
        />
      </div>

      <main className="container mx-auto px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Card className="relative -mt-24 gap-0 bg-surface-low py-0">
            <div className="absolute left-0 top-0 h-1 w-28 bg-primary" aria-hidden="true" />
            <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(240px,0.38fr)_minmax(0,1fr)]">
              <aside className="bg-surface-lowest p-5 sm:p-6 lg:p-8">
                <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
                  Identity Node
                </p>

                <div className="group relative mt-6 aspect-square w-32 bg-surface-low ring-1 ring-outline-variant/20 md:w-40">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary-container font-mono text-5xl font-medium uppercase tracking-[0.08em] text-primary-foreground">
                      {profileInitial}
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-outline-variant/20" />
                  {profileState.isEditingProfile && (
                    <label
                      htmlFor="avatarUpload"
                      className="interactive-hover-primary absolute bottom-2 right-2 flex h-10 w-10 cursor-pointer items-center justify-center border border-outline-variant/20 bg-surface-lowest text-foreground"
                      aria-label="Change avatar"
                    >
                      <Camera className="h-5 w-5" />
                      <input
                        id="avatarUpload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => profileHandlers.handleFileChange(e, "avatar")}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-1">
                  <div className="bg-surface-low p-3 ring-1 ring-outline-variant/20">
                    <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                      Access
                    </p>
                    <p className="mt-1 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-foreground">
                      Owner
                    </p>
                  </div>
                  <div className="bg-surface-low p-3 ring-1 ring-outline-variant/20">
                    <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
                      Handle
                    </p>
                    <p className="mt-1 break-all font-mono text-[0.75rem] uppercase tracking-[0.08em] text-foreground">
                      @{currentUser.username}
                    </p>
                  </div>
                </div>
              </aside>

              <section className="min-w-0 p-5 sm:p-8 lg:p-10">
                {!profileState.isEditingProfile ? (
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <ProfileViewInfo
                      displayName={displayName}
                      email={currentUser.email}
                      bio={currentUser.bio}
                      totalPosts={totalPosts}
                      createdAt={currentUser.createdAt}
                    />
                    <Button
                      onClick={() => profileHandlers.setIsEditingProfile(true)}
                      variant="outline"
                      size="sm"
                      className="w-full lg:w-auto"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit Profile
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="max-w-2xl space-y-3">
                      <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
                        Profile Editor
                      </p>
                      <h1 className="text-3xl font-semibold leading-none tracking-[-0.04em] text-foreground md:text-5xl">
                        Update identity surface
                      </h1>
                      <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                        Keep the public profile precise: name, bio, avatar, and banner updates are applied to your Topos author surface.
                      </p>
                    </div>
                  </div>
                )}
                {profileState.isEditingProfile && (
                  <ProfileEditForm
                    formData={profileState.formData}
                    isSaving={profileState.isSaving}
                    onFormChange={profileHandlers.handleFormChange}
                    onSave={profileHandlers.handleSaveProfile}
                    onCancel={profileHandlers.handleCancel}
                  />
                )}
              </section>
            </CardContent>
          </Card>

          <ProfilePostsSection
            blogs={userBlogs}
            isLoading={isPostsLoading}
            currentPage={currentPage}
            totalPages={totalPages}
            totalPosts={totalPosts}
            handlePageChange={handlePageChange}
          />
        </div>
      </main>
    </div>
  );
};

export default UserProfile;
