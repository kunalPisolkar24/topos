import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Edit, Save, X, Camera, FileText, Mail, Calendar, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "../../hooks/use-toast";
import { StickyNavbar } from "../layouts";
import { BlogCard } from "../blog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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

const DEFAULT_BANNER_URL = "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&q=80&w=1974";

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
      snippet: plainTextBody.substring(0, 150) + (plainTextBody.length > 150 ? "..." : ""),
      author: {
        name: post.author.username,
        avatarUrl: `https://i.pravatar.cc/48?u=${encodeURIComponent(post.author.username)}`,
      },
      tags: post.tags.map((tagItem) => tagItem.tag.name),
      slug: `post-${post.id}`,
      imageUrl: post.imageUrl || "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=600&q=80",
      publishedAt: new Date(post.createdAt),
    };
  });
};

const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [userBlogs, setUserBlogs] = useState<FormattedBlogPost[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({ name: "", bio: "" });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const postsPerPage = 3;

  const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const loggedInUserId = useMemo(() => {
    const token = localStorage.getItem("jwt");
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id;
    } catch (e) {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!loggedInUserId) {
      navigate("/signin");
      return;
    }

    const fetchUserProfile = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("jwt");
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/users/${loggedInUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profile = response.data;
        setUserProfile(profile);
        setFormData({ name: profile.name || "", bio: profile.bio || "" });
        setAvatarPreview(profile.avatarUrl);
        setBannerPreview(profile.bannerUrl);
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
        toast({ title: "Error", description: "Could not load your profile.", variant: "destructive" });
        navigate("/");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [loggedInUserId, navigate]);

  useEffect(() => {
    if (!userProfile) return;

    const fetchUserBlogs = async () => {
      try {
        const token = localStorage.getItem("jwt");
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/users/${userProfile.id}/posts?page=${currentPage}&limit=${postsPerPage}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const formattedBlogs = formatBlogData(response.data.data);
        setUserBlogs(formattedBlogs);
        setTotalPages(response.data.totalPages);
      } catch (error) {
        console.error("Failed to fetch user blogs:", error);
        toast({ title: "Error", description: "Could not load user's blogs.", variant: "destructive" });
      }
    };

    fetchUserBlogs();
  }, [userProfile, currentPage]);

  const uploadToCloudinary = async (file: File) => {
    if (!CLOUDINARY_URL || !CLOUDINARY_UPLOAD_PRESET) {
      toast({ title: "Upload Error", description: "Cloudinary configuration missing.", variant: "destructive" });
      return null;
    }
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    try {
      const response = await axios.post(CLOUDINARY_URL, uploadFormData);
      return response.data.secure_url;
    } catch (error) {
      console.error("Error uploading to Cloudinary:", error);
      toast({ title: "Image Upload Failed", variant: "destructive" });
      return null;
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, fileSetter: React.Dispatch<React.SetStateAction<File | null>>, previewSetter: React.Dispatch<React.SetStateAction<string | null>>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      fileSetter(file);
      const reader = new FileReader();
      reader.onloadend = () => previewSetter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveProfile = async () => {
    if (!userProfile) return;
    setIsSaving(true);

    const updatePayload: { name?: string; bio?: string; avatarUrl?: string | null; bannerUrl?: string | null } = {};

    if (formData.name !== userProfile.name) {
      updatePayload.name = formData.name;
    }
    if (formData.bio !== userProfile.bio) {
      updatePayload.bio = formData.bio;
    }

    if (avatarFile) {
      const newAvatarUrl = await uploadToCloudinary(avatarFile);
      if (!newAvatarUrl) { setIsSaving(false); return; }
      updatePayload.avatarUrl = newAvatarUrl;
    }

    if (bannerFile) {
      const newBannerUrl = await uploadToCloudinary(bannerFile);
      if (!newBannerUrl) { setIsSaving(false); return; }
      updatePayload.bannerUrl = newBannerUrl;
    }

    if (Object.keys(updatePayload).length === 0) {
      toast({ title: "No Changes", description: "You haven't made any changes." });
      setIsSaving(false);
      setIsEditingProfile(false);
      return;
    }

    try {
      const token = localStorage.getItem("jwt");
      const response = await axios.patch(`${import.meta.env.VITE_BACKEND_URL}/api/users/profile`, updatePayload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserProfile(response.data);
      setIsEditingProfile(false);
      setAvatarFile(null);
      setBannerFile(null);
      toast({ title: "Success", description: "Profile updated successfully." });
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast({ title: "Error", description: "Failed to save your profile.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditingProfile(false);
    if (userProfile) {
      setFormData({ name: userProfile.name || "", bio: userProfile.bio || "" });
      setAvatarPreview(userProfile.avatarUrl);
      setBannerPreview(userProfile.bannerUrl);
      setAvatarFile(null);
      setBannerFile(null);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <StickyNavbar />
        <div className="container mx-auto px-4 mt-[50px] pb-16">
          <Skeleton className="h-48 sm:h-64 w-full rounded-xl bg-zinc-800" />
          <div className="max-w-4xl mx-auto -mt-16 sm:-mt-20">
            <div className="p-4 flex flex-col items-center sm:flex-row sm:items-end">
              <Skeleton className="h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-zinc-950 bg-zinc-700 flex-shrink-0" />
              <div className="w-full mt-4 sm:ml-6 sm:mt-0 text-center sm:text-left">
                <Skeleton className="h-10 w-56 mx-auto sm:mx-0 rounded-lg bg-zinc-700" />
                <Skeleton className="h-5 w-72 mt-4 mx-auto sm:mx-0 rounded-lg bg-zinc-700" />
              </div>
            </div>
          </div>
          <div className="max-w-4xl mx-auto space-y-6 mt-12">
            <Skeleton className="h-64 w-full rounded-xl bg-zinc-800" />
            <Skeleton className="h-64 w-full rounded-xl bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  const bannerSrc = bannerPreview || userProfile?.bannerUrl || DEFAULT_BANNER_URL;

  return (
    <div className="min-h-screen bg-zinc-950">
      <StickyNavbar />

      <div className="relative w-full h-48 sm:h-64 bg-zinc-900">
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${bannerSrc})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />

        {isEditingProfile && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <label htmlFor="bannerUpload" className="group cursor-pointer flex flex-col items-center text-zinc-300 hover:text-white transition-colors">
              <div className="p-3 rounded-full bg-zinc-900/50 group-hover:bg-zinc-900/80 border border-zinc-700 transition-all">
                <Camera className="h-6 w-6" />
              </div>
              <span className="mt-2 text-sm font-medium">Change Banner</span>
              <input id="bannerUpload" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setBannerFile, setBannerPreview)} className="hidden" />
            </label>
          </div>
        )}
      </div>

      <main className="container mx-auto px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="relative -mt-16 sm:-mt-20">
            <Card className="bg-zinc-900/50 border-zinc-800 shadow-lg backdrop-blur-sm">
              <CardHeader className="flex flex-row justify-end p-4 pb-0">
                {!isEditingProfile && (
                  <Button onClick={() => setIsEditingProfile(true)} variant="outline" size="sm" className="border-zinc-700 text-zinc-300">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left">
                  <div className="relative group flex-shrink-0">
                    <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-zinc-950 shadow-lg">
                      <AvatarImage src={avatarPreview || undefined} alt={userProfile?.name || userProfile?.username} />
                      <AvatarFallback className="bg-zinc-800 text-zinc-300 text-4xl font-bold">
                        {userProfile?.name?.charAt(0).toUpperCase() || userProfile?.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isEditingProfile && (
                      <label htmlFor="avatarUpload" className="absolute bottom-1 right-1 flex items-center justify-center h-10 w-10 bg-zinc-50 text-zinc-950 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-md">
                        <Camera className="h-5 w-5" />
                        <input id="avatarUpload" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setAvatarFile, setAvatarPreview)} className="hidden" />
                      </label>
                    )}
                  </div>

                  {!isEditingProfile && (
                    <div className="w-full mt-4 sm:ml-6">
                      <div className="space-y-2">
                        <h1 className="text-3xl md:text-4xl font-bold text-zinc-100">{userProfile?.name || userProfile?.username}</h1>
                        <div className="flex items-center justify-center sm:justify-start gap-2 text-zinc-400">
                          <Mail className="h-4 w-4" />
                          <p>{userProfile?.email}</p>
                        </div>
                        <p className="text-zinc-400 leading-relaxed max-w-2xl text-sm md:text-base pt-2">
                          {userProfile?.bio || <span className="italic">No bio added yet.</span>}
                        </p>
                        <div className="flex items-center justify-center sm:justify-start flex-wrap gap-4 pt-2">
                          <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <FileText className="h-4 w-4 text-zinc-400" />
                            <b>{userBlogs.length}</b> Posts
                          </div>
                          <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <Calendar className="h-4 w-4 text-zinc-400" />
                            Joined <b className="font-normal">{new Date(userProfile?.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {isEditingProfile && (
                  <div className="w-full text-left space-y-4 mt-8">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium text-zinc-300">Display Name</label>
                      <Input id="name" name="name" value={formData.name} onChange={handleFormChange} className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="bio" className="text-sm font-medium text-zinc-300">Bio / About</label>
                      <textarea id="bio" name="bio" value={formData.bio} onChange={handleFormChange} className="w-full min-h-[100px] px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-md text-zinc-100 placeholder:text-zinc-500" rows={3} />
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                      <Button onClick={handleCancel} variant="outline" className="border-zinc-700 text-zinc-300">Cancel</Button>
                      <Button onClick={handleSaveProfile} disabled={isSaving} className="bg-zinc-50 hover:bg-zinc-200 text-zinc-950">
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 md:mt-16">
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-100 mb-6">Published Blogs</h2>
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
                            <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }} className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" />
                          )}
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink href="#" onClick={(e) => { e.preventDefault(); handlePageChange(i + 1); }} isActive={currentPage === i + 1} className={`hover:text-zinc-200 hover:bg-zinc-800 ${currentPage === i + 1 ? "text-zinc-100 bg-zinc-800 border-zinc-700" : "text-zinc-400"}`}>
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          {currentPage < totalPages && (
                            <PaginationNext href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }} className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" />
                          )}
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            ) : (
              !isLoading && (
                <Card className="bg-zinc-900/20 border-zinc-800">
                  <CardContent className="py-12 text-center">
                    <FileText className="h-10 w-10 text-zinc-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-zinc-300 mb-2">No blogs published yet</h3>
                    <p className="text-zinc-500 mb-6">When you publish a blog, it will appear here.</p>
                    <Button onClick={() => navigate("/create-blog")} className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200">
                      Create a Blog
                    </Button>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserProfile;