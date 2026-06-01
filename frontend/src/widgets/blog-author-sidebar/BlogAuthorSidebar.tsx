import type React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Edit3, Mail, Trash2, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/shared/lib/cn";

interface Author {
  id: string;
  name?: string | null;
  username: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

interface BlogAuthorSidebarProps {
  author: Author;
  isAuthor: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
}

export const BlogAuthorSidebar: React.FC<BlogAuthorSidebarProps> = ({
  author,
  isAuthor,
  isEditing,
  onEdit,
  onDelete,
  isDeleting,
  isDeleteDialogOpen,
  setIsDeleteDialogOpen,
}) => {
  const [bioExpanded, setBioExpanded] = useState(false);
  const authorInitial = (author.name || author.username).charAt(0).toUpperCase();
  const hasLongBio = (author.bio?.length ?? 0) > 120;

  return (
    <aside className="w-full shrink-0 lg:w-80 xl:w-96">
      <Card className="sticky top-app-navbar-offset gap-0 bg-surface-low py-0">
        <CardHeader className="p-4 sm:p-5">
          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
            Author Node
          </p>
          <div className="mt-4 flex items-start gap-3">
            {isAuthor ? (
              <Link to="/profile" className="group shrink-0" aria-label="Open your profile">
                <Avatar
                  size="lg"
                  className="ring-1 ring-primary/45 transition-colors group-hover:ring-primary"
                >
                  <AvatarImage src={author.avatarUrl || undefined} alt={author.name || author.username} />
                  <AvatarFallback className="bg-primary-container font-mono text-sm uppercase tracking-wider text-primary-foreground">
                    {authorInitial}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Avatar size="lg" className="shrink-0">
                <AvatarImage src={author.avatarUrl || undefined} alt={author.name || author.username} />
                <AvatarFallback className="bg-primary-container font-mono text-sm uppercase tracking-wider text-primary-foreground">
                  {authorInitial}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold tracking-[-0.04em] text-foreground [overflow-wrap:anywhere]">
                {author.name || author.username}
              </h2>
              <p className="mt-1 break-all font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                @{author.username}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="bg-surface-lowest p-3 ring-1 ring-outline-variant/20">
            <div className="flex items-start gap-2 text-muted-foreground">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="break-all text-sm leading-6">{author.email}</p>
            </div>
          </div>

          <div className="bg-surface-lowest p-4 ring-1 ring-outline-variant/20">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
              <h3 className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-primary">
                About Author
              </h3>
            </div>
            <div className="mt-3 text-sm leading-7 text-muted-foreground">
              {author.bio ? (
                <>
                  <p
                    className={cn(
                      "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                      !bioExpanded && hasLongBio && "line-clamp-4",
                    )}
                  >
                    {author.bio}
                  </p>
                  {hasLongBio && (
                    <button
                      type="button"
                      onClick={() => setBioExpanded((prev) => !prev)}
                      className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-primary transition-colors hover:text-primary/80"
                    >
                      {bioExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </>
              ) : (
                <span className="italic">No bio provided.</span>
              )}
            </div>
          </div>

          {isAuthor && !isEditing && (
            <div className="grid gap-3">
              <Button
                variant="outline"
                onClick={onEdit}
                className="w-full"
              >
                <Edit3 size={16} />
                Update Blog
              </Button>

              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} />
                    Delete Blog
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-surface-lowest ring-outline-variant/20">
                  <AlertDialogHeader>
                    <AlertDialogMedia className="rounded-none bg-destructive/10 text-destructive">
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your blog post. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="border-outline-variant/20 bg-surface-low">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={onDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Continue"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>
    </aside>
  );
};
