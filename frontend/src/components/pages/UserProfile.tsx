import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Edit, Save, X, Camera, FileText, Mail, Calendar, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  avatar: string;
  bio: string;
  bannerUrl: string;
}

interface FormattedBlogPost {
  id: number;
  title: string;
  snippet: string;
  author: {
    name: string;
    avatarUrl: string;
  };
  tags: string[];
  slug: string;
  imageUrl: string;
  publishedAt: Date;
}

const dummyUserProfile: UserProfileData = {
  id: 1,
  username: "Kunal Pisolkar",
  email: "kunal.pisolkar@example.com",
  avatar: "https://i.pravatar.cc/128?u=kunalpisolkar",
  bio: "Passionate full-stack developer, blogger, and tech enthusiast. Exploring the latest in web development and sharing insights on various topics.",
  bannerUrl: "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?auto=format&fit=crop&q=80&w=1974",
};

const dummyUserBlogs: FormattedBlogPost[] = [
  { id: 101, title: "Getting Started with Hono.js", snippet: "A comprehensive guide to building fast and lightweight web applications with Hono.js...", author: { name: "Kunal Pisolkar", avatarUrl: "https://i.pravatar.cc/48?u=kunalpisolkar" }, tags: ["Hono.js", "Backend", "JavaScript"], slug: "post-101", imageUrl: "https://images.unsplash.com/photo-1550063873-ab792950096b?auto=format&fit=crop&w=600&q=80", publishedAt: new Date("2025-10-28T10:00:00Z") },
  { id: 102, title: "Mastering Prisma with PostgreSQL", snippet: "Learn how to leverage Prisma's powerful ORM capabilities with a PostgreSQL database...", author: { name: "Kunal Pisolkar", avatarUrl: "https://i.pravatar.cc/48?u=kunalpisolkar" }, tags: ["Prisma", "PostgreSQL", "Database"], slug: "post-102", imageUrl: "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=600&q=80", publishedAt: new Date("2025-10-15T14:30:00Z") },
  { id: 103, title: "Advanced React Patterns", snippet: "Exploring advanced React patterns like Render Props and Hooks to create reusable and clean components.", author: { name: "Kunal Pisolkar", avatarUrl: "https://i.pravatar.cc/48?u=kunalpisolkar" }, tags: ["React", "Frontend", "Design Patterns"], slug: "post-103", imageUrl: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=600&q=80", publishedAt: new Date("2025-09-20T11:00:00Z") },
  { id: 104, title: "Deploying to the Edge with Cloudflare", snippet: "A step-by-step guide on deploying your applications to Cloudflare Workers for optimal performance.", author: { name: "Kunal Pisolkar", avatarUrl: "https://i.pravatar.cc/48?u=kunalpisolkar" }, tags: ["Cloudflare", "Deployment", "Edge Computing"], slug: "post-104", imageUrl: "https://images.unsplash.com/photo-1611117775522-5a268e647b19?auto=format&fit=crop&w=600&q=80", publishedAt: new Date("2025-09-05T09:45:00Z") },
  { id: 105, title: "UI/UX Tips for Developers", snippet: "Practical UI/UX tips that every developer can apply to build more intuitive and user-friendly applications.", author: { name: "Kunal Pisolkar", avatarUrl: "https://i.pravatar.cc/48?u=kunalpisolkar" }, tags: ["UI", "UX", "Design"], slug: "post-105", imageUrl: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=600&q=80", publishedAt: new Date("2025-08-18T18:00:00Z") },
];

const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [userBlogs, setUserBlogs] = useState<FormattedBlogPost[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({ username: "", bio: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 3;

  useEffect(() => {
    const fetchUserProfile = () => {
      setIsLoading(true);
      const token = localStorage.getItem("jwt");
      if (!token) {
        navigate("/signin");
        return;
      }
      setTimeout(() => {
        setUserProfile(dummyUserProfile);
        setUserBlogs(dummyUserBlogs);
        setFormData({
          username: dummyUserProfile.username,
          bio: dummyUserProfile.bio || "",
        });
        setAvatarPreview(dummyUserProfile.avatar);
        setBannerPreview(dummyUserProfile.bannerUrl);
        setIsLoading(false);
      }, 1000);
    };
    fetchUserProfile();
  }, [navigate]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string | null>>) => {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(event.target.files[0]);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveProfile = () => {
    setIsSaving(true);
    setTimeout(() => {
      setUserProfile((prev) => prev ? { ...prev, ...formData, avatar: avatarPreview || prev.avatar, bannerUrl: bannerPreview || prev.bannerUrl } : null);
      setIsEditingProfile(false);
      toast({ title: "Success", description: "Profile updated successfully (Simulated)" });
      setIsSaving(false);
    }, 800);
  };

  const handleCancel = () => {
    setIsEditingProfile(false);
    if (userProfile) {
      setFormData({ username: userProfile.username, bio: userProfile.bio || "" });
      setAvatarPreview(userProfile.avatar);
      setBannerPreview(userProfile.bannerUrl);
    }
  };

  const currentBanner = bannerPreview || userProfile?.bannerUrl;

  const totalPages = Math.ceil(userBlogs.length / postsPerPage);
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentBlogs = userBlogs.slice(indexOfFirstPost, indexOfLastPost);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <StickyNavbar />
        <div className="container mx-auto px-4 mt-[50px] py-8">
          <Skeleton className="h-48 sm:h-64 md:h-80 w-full rounded-xl bg-zinc-800" />
          <div className="max-w-5xl mx-auto -mt-16 sm:-mt-24 md:-mt-32">
            <div className="flex flex-col items-center p-8">
              <Skeleton className="h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-zinc-950 bg-zinc-700" />
              <Skeleton className="h-10 w-56 mt-6 rounded-lg bg-zinc-700" />
              <Skeleton className="h-5 w-72 mt-3 rounded-lg bg-zinc-700" />
            </div>
          </div>
          <div className="max-w-5xl mx-auto space-y-6 mt-8">
            <Skeleton className="h-64 w-full rounded-xl bg-zinc-800" />
            <Skeleton className="h-64 w-full rounded-xl bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <StickyNavbar />

      <div className="relative w-full h-48 sm:h-64 md:h-80">
        <img
          src={currentBanner}
          alt="Banner"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />

        {isEditingProfile && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <label htmlFor="bannerUpload" className="group cursor-pointer flex flex-col items-center text-zinc-300 hover:text-white transition-colors">
              <div className="p-3 rounded-full bg-zinc-900/50 group-hover:bg-zinc-900/80 border border-zinc-700 transition-all">
                <Camera className="h-6 w-6" />
              </div>
              <span className="mt-2 text-sm font-medium">Change Banner</span>
              <input id="bannerUpload" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setBannerPreview)} className="hidden" />
            </label>
          </div>
        )}
      </div>

      <main className="container mx-auto px-4 pb-16">
        <div className="max-w-5xl mx-auto -mt-16 sm:-mt-24 md:-mt-28">

          <Card className="bg-zinc-900/50 border-zinc-800 shadow-lg relative">
            <CardHeader className="flex flex-row justify-end p-4">
              {!isEditingProfile && (
                <Button onClick={() => setIsEditingProfile(true)} variant="outline" size="sm" className="border-zinc-700 text-zinc-300">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-6 md:p-8 pt-0">
              <div className="flex flex-col items-center text-center">

                <div className="relative group">
                  <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-zinc-950 shadow-lg">
                    <AvatarImage src={avatarPreview || userProfile?.avatar} alt={userProfile?.username} />
                    <AvatarFallback className="bg-zinc-800 text-zinc-300 text-4xl font-bold">
                      {userProfile?.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isEditingProfile && (
                    <label htmlFor="avatarUpload" className="absolute -bottom-2 -right-2 flex items-center justify-center h-10 w-10 bg-zinc-50 text-zinc-950 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-md">
                      <Camera className="h-5 w-5" />
                      <input id="avatarUpload" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setAvatarPreview)} className="hidden" />
                    </label>
                  )}
                </div>

                {isEditingProfile ? (
                  <div className="w-full max-w-2xl mt-8 space-y-6 text-left">
                    <div className="space-y-2">
                      <label htmlFor="username" className="text-sm font-medium text-zinc-300">Username</label>
                      <Input id="username" name="username" value={formData.username} onChange={handleFormChange} className="bg-zinc-800/50 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 h-11" />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="bio" className="text-sm font-medium text-zinc-300">Bio / About</label>
                      <textarea id="bio" name="bio" value={formData.bio} onChange={handleFormChange} className="w-full min-h-[100px] px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-md text-zinc-100 placeholder:text-zinc-500" rows={3} />
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                      <Button onClick={handleCancel} variant="outline" className="border-zinc-700 text-zinc-300">
                        Cancel
                      </Button>
                      <Button onClick={handleSaveProfile} disabled={isSaving} className="bg-zinc-50 hover:bg-zinc-200 text-zinc-950">
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isSaving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    <h1 className="text-3xl md:text-4xl font-bold text-zinc-100">{userProfile?.username}</h1>
                    <div className="flex items-center justify-center gap-2 text-zinc-400">
                      <Mail className="h-4 w-4" />
                      <p>{userProfile?.email}</p>
                    </div>
                    <p className="text-zinc-400 leading-relaxed max-w-2xl text-sm md:text-base">
                      {userProfile?.bio || <span className="italic">No bio added yet.</span>}
                    </p>
                    <div className="flex items-center justify-center flex-wrap gap-4 pt-4">
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <FileText className="h-4 w-4 text-zinc-400" />
                        <b>{userBlogs.length}</b> Posts
                      </div>
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <Calendar className="h-4 w-4 text-zinc-400" />
                        Joined <b className="font-normal">October 2025</b>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="mt-12 md:mt-16">
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-100 mb-6">
              Published Blogs
            </h2>
            {userBlogs.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-6">
                  {currentBlogs.map((blog) => (
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
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(currentPage - 1);
                              }}
                              className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                            />
                          )}
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(i + 1);
                              }}
                              isActive={currentPage === i + 1}
                              className={`hover:text-zinc-200 hover:bg-zinc-800 ${currentPage === i + 1
                                  ? "text-zinc-100 bg-zinc-800 border-zinc-700"
                                  : "text-zinc-400"
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
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(currentPage + 1);
                              }}
                              className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                            />
                          )}
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            ) : (
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default UserProfile;