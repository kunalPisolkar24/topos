import type React from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, Edit3 } from "lucide-react";
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
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

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
    <aside className="w-full lg:w-80 xl:w-96 shrink-0">
      <Card className="sticky top-24 bg-surface-lowest gap-0 p-0">
        <CardHeader className="items-center text-center px-6 pt-6 pb-4">
          {isAuthor ? (
            <Link to="/profile" className="group inline-block">
              <Avatar
                size="lg"
                className="mx-auto mb-4 ring-1 ring-primary/45 transition-shadow group-hover:ring-primary"
              >
                <AvatarImage src={author.avatarUrl || undefined} alt={author.name || author.username} />
                <AvatarFallback className="bg-primary-container text-primary-foreground font-mono text-sm uppercase tracking-wider">
                  {authorInitial}
                </AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Avatar
              size="lg"
              className="mx-auto mb-4"
            >
              <AvatarImage src={author.avatarUrl || undefined} alt={author.name || author.username} />
              <AvatarFallback className="bg-muted text-muted-foreground font-mono text-sm uppercase tracking-wider">
                {authorInitial}
              </AvatarFallback>
            </Avatar>
          )}
          <h2 className="text-xl font-semibold text-foreground tracking-[-0.02em] break-words [overflow-wrap:anywhere]">
            {author.name || author.username}
          </h2>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground break-all">
            {author.email}
          </p>
        </CardHeader>

        <CardContent className="px-6 pb-6 space-y-6">
          <div className="space-y-3">
            <h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-primary">
              About Author
            </h3>
            <div className="text-sm text-muted-foreground leading-relaxed">
              {author.bio ? (
                <>
                  <p className={cn(
                    "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                    !bioExpanded && hasLongBio && "line-clamp-3"
                  )}>
                    {author.bio}
                  </p>
                  {hasLongBio && (
                    <button
                      type="button"
                      onClick={() => setBioExpanded((prev) => !prev)}
                      className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-primary hover:text-primary/80 transition-colors"
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
            <div className="flex flex-col gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onEdit}
                className="w-full"
              >
                <Edit3 size={16} className="mr-2" />
                Update Blog
              </Button>

              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete Blog
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your blog post. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
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
