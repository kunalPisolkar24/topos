import type React from "react";
import { Link } from "react-router-dom";
import { Trash2, Edit3 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const authorInitial = (author.name || author.username).charAt(0).toUpperCase();

  return (
    <aside className="w-full lg:w-1/3 lg:max-w-xs xl:max-w-sm">
      <Card className="sticky top-20 shadow-lg bg-zinc-900/20 border-zinc-800">
        <CardHeader className="text-center">
          <Link 
            to={isAuthor ? "/profile" : `/user/${author.id}`} 
            className="group inline-block"
          >
            <Avatar className="w-24 h-24 mx-auto mb-4 border-2 border-zinc-700 group-hover:border-zinc-500 transition-colors">
              <AvatarImage src={author.avatarUrl || undefined} alt={author.name || author.username} />
              <AvatarFallback className="text-4xl bg-zinc-800 text-zinc-300">{authorInitial}</AvatarFallback>
            </Avatar>
          </Link>
          <CardTitle className="mb-1 break-words text-xl text-zinc-100 [overflow-wrap:anywhere]">
            {author.name || author.username}
          </CardTitle>
          <p className="break-all text-sm text-zinc-400">{author.email}</p>
        </CardHeader>
        <CardContent className="pt-6 border-t border-zinc-800">
          <h3 className="font-semibold mb-2 text-zinc-200">About Author</h3>
          <p className="mb-6 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm text-zinc-400 [overflow-wrap:anywhere]">
            {author.bio || <span className="italic">No bio provided.</span>}
          </p>
          
          {isAuthor && !isEditing && (
            <div className="flex flex-col space-y-3">
              <Button 
                variant="outline" 
                onClick={onEdit} 
                className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <Edit3 size={16} className="mr-2" /> Update Blog
              </Button>
              
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="w-full bg-red-900 hover:bg-red-800" 
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} className="mr-2" /> Delete Blog
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-zinc-100">Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400">
                      This will permanently delete your blog post. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={onDelete} 
                      className="bg-red-900 hover:bg-red-800 text-white" 
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
