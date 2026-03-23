"use client";

import React from "react";
import { Camera, Edit } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth";
import { StickyNavbar } from "@/layouts";
import { 
  useUserProfile,
  useUserPosts,
  ProfileBanner,
  ProfileViewInfo,
  ProfileEditForm,
  ProfilePostsSection,
} from "@/features/user";

const DEFAULT_BANNER_URL = "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&q=80&w=1974";

const UserProfile: React.FC = () => {
  const { user: currentUser, loading: isUserLoading } = useCurrentUser();
  
  const { state: profileState, handlers: profileHandlers } = useUserProfile(currentUser);
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
      <div className="min-h-screen bg-zinc-950">
        <StickyNavbar />
        <div className="container mx-auto px-4 pb-16 pt-app-navbar">
          <Skeleton className="h-48 w-full rounded-xl bg-zinc-800 sm:h-64" />
          <div className="mx-auto -mt-16 max-w-4xl sm:-mt-20">
            <div className="flex flex-col items-center p-4 sm:flex-row sm:items-end">
              <Skeleton className="h-32 w-32 flex-shrink-0 rounded-full border-4 border-zinc-950 bg-zinc-700 md:h-40 md:w-40" />
              <div className="mt-4 w-full text-center sm:ml-6 sm:mt-0 sm:text-left">
                <Skeleton className="mx-auto h-10 w-56 rounded-lg bg-zinc-700 sm:mx-0" />
                <Skeleton className="mx-auto mt-4 h-5 w-72 rounded-lg bg-zinc-700 sm:mx-0" />
              </div>
            </div>
          </div>
          <div className="mx-auto mt-12 max-w-4xl space-y-6">
            <Skeleton className="h-64 w-full rounded-xl bg-zinc-800" />
            <Skeleton className="h-64 w-full rounded-xl bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  const bannerSrc = profileState.bannerPreview || currentUser.bannerUrl || DEFAULT_BANNER_URL;
  const displayName = currentUser.name || currentUser.username;

  return (
    <div className="min-h-screen bg-zinc-950">
      <StickyNavbar />

      <div className="pt-app-navbar">
        <ProfileBanner
          bannerUrl={bannerSrc}
          isEditing={profileState.isEditingProfile}
          onBannerChange={(e) => profileHandlers.handleFileChange(e, "banner")}
        />
      </div>

      <main className="container mx-auto px-4 pb-16">
        <div className="mx-auto max-w-4xl">
          <div className="relative -mt-16 sm:-mt-20">
            <Card className="border-zinc-800 bg-zinc-900/50 shadow-lg backdrop-blur-sm">
              <CardHeader className="flex flex-row justify-end p-4 pb-0">
                {!profileState.isEditingProfile && (
                  <Button
                    onClick={() => profileHandlers.setIsEditingProfile(true)}
                    variant="outline"
                    size="sm"
                    className="border-zinc-700 text-zinc-300"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left">
                  <div className="group relative flex-shrink-0">
                    <Avatar className="h-32 w-32 border-4 border-zinc-950 shadow-lg md:h-40 md:w-40">
                      <AvatarImage
                        src={profileState.avatarPreview || undefined}
                        alt={currentUser.name || currentUser.username}
                      />
                      <AvatarFallback className="bg-zinc-800 text-4xl font-bold text-zinc-300">
                        {currentUser.name?.charAt(0).toUpperCase() ||
                          currentUser.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {profileState.isEditingProfile && (
                      <label
                        htmlFor="avatarUpload"
                        className="absolute bottom-1 right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-zinc-50 text-zinc-950 shadow-md transition-transform hover:scale-110"
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

                  {!profileState.isEditingProfile ? (
                    <ProfileViewInfo 
                      displayName={displayName}
                      email={currentUser.email}
                      bio={currentUser.bio}
                      totalPosts={totalPosts}
                      createdAt={currentUser.createdAt}
                    />
                  ) : null}
                </div>

                {profileState.isEditingProfile && (
                  <ProfileEditForm 
                    formData={profileState.formData}
                    isSaving={profileState.isSaving}
                    onFormChange={profileHandlers.handleFormChange}
                    onSave={profileHandlers.handleSaveProfile}
                    onCancel={profileHandlers.handleCancel}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <ProfilePostsSection 
            blogs={userBlogs}
            isLoading={isPostsLoading}
            currentPage={currentPage}
            totalPages={totalPages}
            handlePageChange={handlePageChange}
          />
        </div>
      </main>
    </div>
  );
};

export default UserProfile;
