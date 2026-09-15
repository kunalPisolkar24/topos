import { DEFAULT_BLOG_CARD_IMAGE } from "@/entities/post/lib/blog-card";
import { toPlainText } from "@/entities/post/lib/post-text";

export const BLOG_CARD_SNIPPET_MAX_CHARS = 120;
export const BLOG_CARD_SNIPPET_ELLIPSIS = "...";

const BLOG_CARD_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
});

type AuthorLike = {
  username: string;
  name?: string | null;
  avatarUrl?: string | null;
};

type TagLike = {
  name: string;
};

type PostLike = {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
  likedByMe: boolean;
  savedByMe: boolean;
  author: AuthorLike;
  tags: TagLike[];
};

export interface BlogCardItem {
  id: string;
  title: string;
  snippet: string;
  author: {
    name: string;
  };
  tags: string[];
  imageUrl: string | null;
  publishedAt: string | null;
  likedByMe: boolean;
  savedByMe: boolean;
  reason?: string;
}

export function getAuthorDisplayName(author: AuthorLike) {
  const normalizedName = author.name?.trim();
  return normalizedName || author.username;
}

export function formatBlogCardDate(publishedAt: Date | string) {
  const dateValue =
    publishedAt instanceof Date ? publishedAt : new Date(publishedAt);

  if (Number.isNaN(dateValue.getTime())) {
    return null;
  }

  return BLOG_CARD_DATE_FORMATTER.format(dateValue).toUpperCase();
}

export function formatBlogCardTag(tag: string) {
  const normalizedTag = tag.trim().replace(/^#+/, "").replace(/\s+/g, "_");

  return `#${normalizedTag.toUpperCase()}`;
}

export function truncateSnippet(text: string, maxChars: number): string {
  const trimmed = text.trim();

  if (trimmed.length === 0 || trimmed.length <= maxChars) {
    return trimmed;
  }

  const window = trimmed.slice(0, maxChars);
  const lastWhitespace = window.search(/\s\S*$/);

  const cutPoint = lastWhitespace > 0 ? lastWhitespace : maxChars;
  return `${window.slice(0, cutPoint).trimEnd()}${BLOG_CARD_SNIPPET_ELLIPSIS}`;
}

export function mapPostToBlogCardItem(post: PostLike): BlogCardItem {
  const plainTextBody = toPlainText(post.body);

  return {
    id: post.id,
    title: post.title,
    snippet: truncateSnippet(plainTextBody, BLOG_CARD_SNIPPET_MAX_CHARS),
    author: {
      name: getAuthorDisplayName(post.author),
    },
    tags: post.tags.map((tag) => tag.name),
    imageUrl: post.imageUrl || DEFAULT_BLOG_CARD_IMAGE,
    publishedAt: post.createdAt,
    likedByMe: post.likedByMe,
    savedByMe: post.savedByMe,
  };
}

export function buildSearchPagination(
  totalResults: number,
  currentPage: number,
  pageSize: number,
) {
  return {
    currentPage,
    totalPages: Math.max(1, Math.ceil(totalResults / pageSize)),
    totalResults,
  };
}
