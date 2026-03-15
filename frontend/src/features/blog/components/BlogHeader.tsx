import type React from "react";
import { Clock } from "lucide-react";

interface BlogHeaderProps {
  title: string;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const BlogHeader: React.FC<BlogHeaderProps> = ({ 
  title, 
  imageUrl, 
  createdAt, 
  updatedAt 
}) => {
  const formatDate = (date: string) => 
    new Date(date).toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric",
    });

  return (
    <>
      {imageUrl && (
        <div className="mb-8 rounded-xl overflow-hidden shadow-lg border border-zinc-900">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-auto max-h-[400px] object-cover"
          />
        </div>
      )}
      <h1 className="text-3xl lg:text-5xl font-bold mb-4 text-zinc-100">{title}</h1>
      <div className="flex items-center space-x-2 text-xs text-zinc-400 mb-6">
        <Clock className="h-4 w-4" />
        <span>Published on {formatDate(createdAt)}</span>
        {createdAt !== updatedAt && (
          <span>(Updated on {formatDate(updatedAt)})</span>
        )}
      </div>
    </>
  );
};
