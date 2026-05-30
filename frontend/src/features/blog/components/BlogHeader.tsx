import type React from "react";

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
  updatedAt,
}) => {
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <>
      {imageUrl && (
        <div className="mb-8 ring-1 ring-outline-variant/20 overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-auto max-h-[400px] object-cover"
          />
        </div>
      )}
      <h1 className="text-3xl lg:text-5xl font-bold mb-4 text-foreground tracking-[-0.02em]">
        {title}
      </h1>
      <div className="flex items-center gap-3 mb-6 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted-foreground">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 bg-primary"
        />
        <span>Published on {formatDate(createdAt)}</span>
        {createdAt !== updatedAt && (
          <span>(Updated on {formatDate(updatedAt)})</span>
        )}
      </div>
    </>
  );
};
