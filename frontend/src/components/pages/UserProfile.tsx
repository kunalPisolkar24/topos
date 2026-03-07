import React, { useEffect, useMemo, useState } from "react";
import { useMutation } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
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
import { UpdateProfileDocument } from "@/graphql/generated/graphql";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "@/hooks/use-toast";
import { env } from "@/lib/env";
import { useSessionStore } from "@/stores/session-store";
import { BlogCard } from "../blog";
import { StickyNavbar } from "../layouts";

interface UserProfileData {
  id: number;
  username: string;
  email: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  createdAt: string;
}

interface BlogPost {
  id: number;
  title: string;
  body: string;
  imageUrl?: string;
  author: { id: number; username: string; email: string };
  tags: { tag: { name: string } }[];
  createdAt: string;
}

interface FormattedBlogPost {
  id: number;
  title: string;
  snippet: string;
  author: { name: string; avatarUrl: string };
  tags: string[];
  slug: string;
  imageUrl: string;
  publishedAt: Date;
}

const DEFAULT_BANNER_URL =
  "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&q=80&w=1974";

const stripHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
};

const formatBlogData = (data: BlogPost[]): FormattedBlogPost[] => {
  return data.map((post) => {
    const plainTextBody = stripHtml(post.body);

    return {
      id: post.id,
      title: post.title,
      snippet:
        plainTextBody.substring(0, 150) +
        (plainTextBody.length > 150 ? "..." : ""),
      author: {
        name: post.author.username,
        avatarUrl: `https://i.pravatar.cc/48?u=${encodeURIComponent(
          post.author.username,
        )}`,
      },
      tags: post.tags.map((tagItem) => tagItem.tag.name),
      slug: `post-${post.id}`,
      imageUrl:
        post.imageUrl ||
        "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=600&q=80",
      publishedAt: new Date(post.createdAt),
    };
  });
};

const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const token = useSessionStore((state) => state.token);
  const { user: currentUser, loading: isUserLoading } = useCurrentUser();
  const [userBlogs, setUserBlogs] = useState<FormattedBlogPost[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", bio: "" });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [updateProfile, { loading: isSaving }] = useMutation(
    UpdateProfileDocument,
  );

  const cloudinaryUrl = env.VITE_CLOUDINARY_CLOUD_NAME
    ? `https://api.cloudinary.com/v1_1/${env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`
    : "";
  const cloudinaryUploadPreset = env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const postsPerPage = 3;

  const userProfile = useMemo<UserProfileData | null>(() => {
    if (!currentUser) {
      return null;
    }

    return {
      id: Number(currentUser.id),
      username: currentUser.username,
      email: currentUser.email,
      name: currentUser.name ?? null,
      bio: currentUser.bio ?? null,
      avatarUrl: currentUser.avatarUrl ?? null,
      bannerUrl: currentUser.bannerUrl ?? null,
      createdAt: currentUser.createdAt,
    };
  }, [currentUser]);

  useEffect(() => {
    if (!userProfile || isEditingProfile) {
      return;
    }

    setFormData({
      name: userProfile.name || "",
      bio: userProfile.bio || "",
    });
    setAvatarPreview(userProfile.avatarUrl);
    setBannerPreview(userProfile.bannerUrl);
  }, [isEditingProfile, userProfile]);

  useEffect(() => {
    if (!userProfile || !env.VITE_BACKEND_URL) {
      setUserBlogs([]);
      setTotalPages(1);
      return;
    }

    let cancelled = false;

    const fetchUserBlogs = async () => {
      try {
        const response = await axios.get(
          `${env.VITE_BACKEND_URL}/api/users/${userProfile.id}/posts?page=${currentPage}&limit=${postsPerPage}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
        );

        if (cancelled) {
          return;
        }

        setUserBlogs(formatBlogData(response.data.data));
        setTotalPages(response.data.totalPages);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to fetch user blogs:", error);
        toast({
          title: "Error",
          description: "Could not load your blogs.",
          variant: "destructive",
        });
      }
    };

    void fetchUserBlogs();

    return () => {
      cancelled = true;
    };
  }, [currentPage, postsPerPage, token, userProfile]);

  const uploadToCloudinary = async (file: File) => {
    if (!cloudinaryUrl || !cloudinaryUploadPreset) {
      toast({
        title: "Upload Error",
        description: "Cloudinary configuration missing.",
        variant: "destructive",
      });
      return null;
    }

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("upload_preset", cloudinaryUploadPreset);

    try {
      const response = await axios.post(cloudinaryUrl, uploadFormData);
      return response.data.secure_url as string;
    } catch (error) {
      console.error("Error uploading to Cloudinary:", error);
      toast({
        title: "Image Upload Failed",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    fileSetter: React.Dispatch<React.SetStateAction<File | null>>,
    previewSetter: React.Dispatch<React.SetStateAction<string | null>>,
  ) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      fileSetter(file);
      const reader = new FileReader();
      reader.onloadend = () => previewSetter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFormChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSaveProfile = async () => {
    if (!userProfile) {
      return;
    }

    const updatePayload: {
      name?: string;
      bio?: string | null;
      avatarUrl?: string | null;
      bannerUrl?: string | null;
    } = {};

    const trimmedName = formData.name.trim();
    const trimmedBio = formData.bio.trim();

    if (trimmedName && trimmedName !== (userProfile.name || "")) {
      updatePayload.name = trimmedName;
    }

    if (trimmedBio !== (userProfile.bio || "")) {
      updatePayload.bio = trimmedBio || null;
    }

    if (avatarFile) {
      const nextAvatarUrl = await uploadToCloudinary(avatarFile);
      if (!nextAvatarUrl) {
        return;
      }
      updatePayload.avatarUrl = nextAvatarUrl;
    }

    if (bannerFile) {
      const nextBannerUrl = await uploadToCloudinary(bannerFile);
      if (!nextBannerUrl) {
        return;
      }
      updatePayload.bannerUrl = nextBannerUrl;
    }

    if (Object.keys(updatePayload).length === 0) {
      toast({
        title: "No Changes",
        description: "You haven't made any changes.",
      });
      setIsEditingProfile(false);
      return;
    }

    try {
      const { data } = await updateProfile({
        variables: updatePayload,
      });

      const updatedProfile = data?.updateProfile;

      if (!updatedProfile) {
        throw new Error("Profile update response was empty.");
      }

      setFormData({
        name: updatedProfile.name || "",
        bio: updatedProfile.bio || "",
      });
      setAvatarPreview(updatedProfile.avatarUrl ?? null);
      setBannerPreview(updatedProfile.bannerUrl ?? null);
      setAvatarFile(null);
      setBannerFile(null);
      setIsEditingProfile(false);

      toast({
        title: "Success",
        description: "Profile updated successfully.",
      });
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast({
        title: "Error",
        description: "Failed to save your profile.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setIsEditingProfile(false);

    if (!userProfile) {
      return;
    }

    setFormData({
      name: userProfile.name || "",
      bio: userProfile.bio || "",
    });
    setAvatarPreview(userProfile.avatarUrl);
    setBannerPreview(userProfile.bannerUrl);
    setAvatarFile(null);
    setBannerFile(null);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

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

  if (!userProfile) {
    return null;
  }

  const bannerSrc = bannerPreview || userProfile.bannerUrl || DEFAULT_BANNER_URL;

  return (
    <div className="min-h-screen bg-zinc-950">
      <StickyNavbar />

      <div className="relative h-48 w-full bg-zinc-900 sm:h-64">
        <div
          className="absolute inset-0 h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${bannerSrc})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />

        {isEditingProfile && (
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
                onChange={(event) =>
                  handleFileChange(event, setBannerFile, setBannerPreview)
                }
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
                {!isEditingProfile && (
                  <Button
                    onClick={() => setIsEditingProfile(true)}
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
                        src={avatarPreview || undefined}
                        alt={userProfile.name || userProfile.username}
                      />
                      <AvatarFallback className="bg-zinc-800 text-4xl font-bold text-zinc-300">
                        {userProfile.name?.charAt(0).toUpperCase() ||
                          userProfile.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isEditingProfile && (
                      <label
                        htmlFor="avatarUpload"
                        className="absolute bottom-1 right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-zinc-50 text-zinc-950 shadow-md transition-transform hover:scale-110"
                      >
                        <Camera className="h-5 w-5" />
                        <input
                          id="avatarUpload"
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            handleFileChange(
                              event,
                              setAvatarFile,
                              setAvatarPreview,
                            )
                          }
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {!isEditingProfile && (
                    <div className="mt-4 w-full sm:ml-6">
                      <div className="space-y-2">
                        <h1 className="text-3xl font-bold text-zinc-100 md:text-4xl">
                          {userProfile.name || userProfile.username}
                        </h1>
                        <div className="flex items-center justify-center gap-2 text-zinc-400 sm:justify-start">
                          <Mail className="h-4 w-4" />
                          <p>{userProfile.email}</p>
                        </div>
                        <p className="max-w-2xl pt-2 text-sm leading-relaxed text-zinc-400 md:text-base">
                          {userProfile.bio || (
                            <span className="italic">No bio added yet.</span>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 sm:justify-start">
                          <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <FileText className="h-4 w-4 text-zinc-400" />
                            <b>{userBlogs.length}</b> Posts
                          </div>
                          <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <Calendar className="h-4 w-4 text-zinc-400" />
                            Joined{" "}
                            <b className="font-normal">
                              {new Date(userProfile.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "long",
                                  year: "numeric",
                                },
                              )}
                            </b>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isEditingProfile && (
                  <div className="mt-8 w-full space-y-4 text-left">
                    <div className="space-y-2">
                      <label
                        htmlFor="name"
                        className="text-sm font-medium text-zinc-300"
                      >
                        Display Name
                      </label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleFormChange}
                        className="border-zinc-700 bg-zinc-800/50 text-zinc-100 placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="bio"
                        className="text-sm font-medium text-zinc-300"
                      >
                        Bio / About
                      </label>
                      <textarea
                        id="bio"
                        name="bio"
                        value={formData.bio}
                        onChange={handleFormChange}
                        className="min-h-[100px] w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
                        rows={3}
                      />
                    </div>
                    <div className="flex flex-col justify-end gap-3 pt-2 sm:flex-row">
                      <Button
                        onClick={handleCancel}
                        variant="outline"
                        className="border-zinc-700 text-zinc-300"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => void handleSaveProfile()}
                        disabled={isSaving}
                        className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
                      >
                        {isSaving && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {isSaving ? "Saving..." : "Save Changes"}
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
            {userBlogs.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-6">
                  {userBlogs.map((blog) => (
                    <BlogCard key={blog.slug} {...blog} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="mt-10">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          {currentPage > 1 && (
                            <PaginationPrevious
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                handlePageChange(currentPage - 1);
                              }}
                              className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                            />
                          )}
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, index) => (
                          <PaginationItem key={index}>
                            <PaginationLink
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                handlePageChange(index + 1);
                              }}
                              isActive={currentPage === index + 1}
                              className={`hover:bg-zinc-800 hover:text-zinc-200 ${
                                currentPage === index + 1
                                  ? "border-zinc-700 bg-zinc-800 text-zinc-100"
                                  : "text-zinc-400"
                              }`}
                            >
                              {index + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          {currentPage < totalPages && (
                            <PaginationNext
                              href="#"
                              onClick={(event) => {
                                event.preventDefault();
                                handlePageChange(currentPage + 1);
                              }}
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
                  <h3 className="mb-2 text-xl font-semibold text-zinc-300">
                    No blogs published yet
                  </h3>
                  <p className="mb-6 text-zinc-500">
                    When you publish a blog, it will appear here.
                  </p>
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
