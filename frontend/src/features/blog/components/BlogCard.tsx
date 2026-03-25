import type React from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import {
  DEFAULT_BLOG_CARD_IMAGE,
  formatBlogCardDate,
  formatBlogCardTag,
  type BlogCardItem,
} from "@/lib/content";

const MAX_VISIBLE_TAGS = 3;

type BlogCardProps = BlogCardItem;

export const BlogCard: React.FC<BlogCardProps> = ({
  imageUrl,
  title,
  snippet,
  author,
  tags,
  id,
  publishedAt,
}) => {
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
  const remainingTagsCount = tags.length - MAX_VISIBLE_TAGS;
  const formattedDate = formatBlogCardDate(publishedAt);
  const authorName = author.name.trim() || "Unknown Author";
  const publishedAtValue = publishedAt;

  return (
    <Link
      to={`/blog/${id}`}
      className="group block focus-visible:outline-none"
      aria-label={`Open blog post: ${title}`}
    >
      <Card className="gap-0 bg-surface-lowest py-0 transition-colors duration-200 group-hover:bg-surface-low group-focus-visible:bg-surface-low group-focus-visible:ring-primary">
        <div className="grid min-w-0 gap-0 md:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.95fr)]">
          <div className="flex min-w-0 flex-col justify-between px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
            <div className="space-y-4">
              <div className="space-y-3">
                <h2 className="line-clamp-3 text-[1.45rem] font-semibold leading-[1.04] tracking-[-0.035em] text-foreground sm:text-[1.8rem]">
                  {title}
                </h2>
                <p className="line-clamp-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:line-clamp-4 sm:text-[0.95rem]">
                  {snippet}
                </p>
              </div>

              {visibleTags.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-primary/90">
                  {visibleTags.map((tag) => (
                    <span key={tag}>{formatBlogCardTag(tag)}</span>
                  ))}
                  {remainingTagsCount > 0 && (
                    <span className="text-muted-foreground">
                      +{remainingTagsCount} MORE
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 border border-primary/45 bg-primary-container/80"
              />
              <span className="text-foreground/90">{authorName}</span>
              {formattedDate ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-3 w-px bg-outline-variant/30"
                  />
                  <time dateTime={publishedAtValue}>{formattedDate}</time>
                </>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-[220px] bg-surface-low">
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(event) => {
                if (event.currentTarget.src !== DEFAULT_BLOG_CARD_IMAGE) {
                  event.currentTarget.src = DEFAULT_BLOG_CARD_IMAGE;
                }
              }}
            />
          </div>
        </div>
      </Card>
    </Link>
  );
};
