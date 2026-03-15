"use client";

import React from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Camera, Edit, FileText, Loader2, Mail } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  getCharacterCount,
} from "@/lib/user-input";
import { BlogCardSkeleton } from "@/components/skeletons";
import { BlogCard } from "../blog";
import { StickyNavbar } from "../layouts";
import { useUserProfile } from "@/hooks/user/use-user-profile";
import { useUserPosts } from "@/hooks/user/use-user-posts";

const DEFAULT_BANNER_URL = "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&q=80&w=1974";

const UserProfile: React.FC = () => {
  const navigate = useNavigate();
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
        <div className="container mx-auto mt-[50px] px-4 pb-16">
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

      <div className="relative h-48 w-full bg-zinc-900 sm:h-64">
        <div
          className="absolute inset-0 h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${bannerSrc})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />

        {profileState.isEditingProfile && (
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
                onChange={(e) => profileHandlers.handleFileChange(e, "banner")}
                className="hidden"
              />
            </label>
          </div>
        )}
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

                  {!profileState.isEditingProfile && (
                    <div className="mt-4 w-full min-w-0 sm:ml-6">
                      <div className="space-y-2">
                        <h1 className="max-w-full break-words text-3xl font-bold text-zinc-100 [overflow-wrap:anywhere] md:text-4xl">
                          {displayName}
                        </h1>
                        <div className="flex w-full flex-wrap items-center justify-center gap-2 text-zinc-400 sm:justify-start">
                          <Mail className="h-4 w-4" />
                          <p className="break-all">{currentUser.email}</p>
                        </div>
                        <p className="max-h-48 max-w-2xl overflow-y-auto whitespace-pre-wrap break-words pt-2 pr-2 text-sm leading-relaxed text-zinc-400 [overflow-wrap:anywhere] md:text-base">
                          {currentUser.bio || <span className="italic">No bio added yet.</span>}
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
                              {new Date(currentUser.createdAt).toLocaleDateString("en-US", {
                                month: "long",
                                year: "numeric",
                              })}
                            </b>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {profileState.isEditingProfile && (
                  <div className="mt-8 w-full space-y-4 text-left">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium text-zinc-300">
                        Display Name
                      </label>
                      <Input
                        id="name"
                        name="name"
                        value={profileState.formData.name}
                        onChange={profileHandlers.handleFormChange}
                        maxLength={PROFILE_NAME_MAX_LENGTH}
                        className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500"
                      />
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Up to {PROFILE_NAME_MAX_LENGTH} characters</span>
                        <span>
                          {getCharacterCount(profileState.formData.name)}/{PROFILE_NAME_MAX_LENGTH}
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
                        value={profileState.formData.bio}
                        onChange={profileHandlers.handleFormChange}
                        maxLength={PROFILE_BIO_MAX_LENGTH}
                        className="min-h-[100px] w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
                        rows={3}
                      />
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Up to {PROFILE_BIO_MAX_LENGTH} characters</span>
                        <span>
                          {getCharacterCount(profileState.formData.bio)}/{PROFILE_BIO_MAX_LENGTH}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-end gap-3 pt-2 sm:flex-row">
                      <Button
                        onClick={profileHandlers.handleCancel}
                        variant="outline"
                        className="border-zinc-700 text-zinc-300"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={profileHandlers.handleSaveProfile}
                        disabled={profileState.isSaving}
                        className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
                      >
                        {profileState.isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {profileState.isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 md:mt-16">
            <h2 className="mb-6 text-2xl font-bold text-zinc-100 md:text-3xl">
              Published Blogs
            </h2>
            {isPostsLoading ? (
              <div className="grid grid-cols-1 gap-6">
                {[...Array(3)].map((_, i) => <BlogCardSkeleton key={i} />)}
              </div>
            ) : userBlogs.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-6">
                  {userBlogs.map((blog) => <BlogCard key={blog.id} {...blog} />)}
                </div>
                {totalPages > 1 && (
                  <div className="mt-10">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          {currentPage > 1 && (
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }}
                              className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                            />
                          )}
                        </PaginationItem>
                        {[...Array(totalPages)].map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => { e.preventDefault(); handlePageChange(i + 1); }}
                              isActive={currentPage === i + 1}
                              className={`hover:bg-zinc-800 hover:text-zinc-200 ${
                                currentPage === i + 1 ? "border-zinc-700 bg-zinc-800 text-zinc-100" : "text-zinc-400"
                              }`}
                            >
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          {currentPage < totalPages && (
                            <PaginationNext
                              href="#"
                              onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }}
                              className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                            />
                          )}
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            ) : (
              <Card className="border-zinc-800 bg-zinc-900/20">
                <CardContent className="py-12 text-center">
                  <FileText className="mx-auto mb-4 h-10 w-10 text-zinc-600" />
                  <h3 className="mb-2 text-xl font-semibold text-zinc-300">No blogs published yet</h3>
                  <p className="mb-6 text-zinc-500">When you publish a blog, it will appear here.</p>
                  <Button
                    onClick={() => navigate("/create-blog")}
                    className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
                  >
                    Create a Blog
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserProfile;
