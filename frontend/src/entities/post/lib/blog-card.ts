export const DEFAULT_BLOG_CARD_IMAGE =
  "https://images.unsplash.com/photo-1554995207-c18c203602cb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=600&q=80";

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
  imageUrl: string;
  publishedAt: string;
}

export function stripHtml(html: string) {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  }

  return html.replace(/<[^>]+>/g, "");
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

export function mapPostToBlogCardItem(post: PostLike): BlogCardItem {
  const plainTextBody = stripHtml(post.body);

  return {
    id: post.id,
    title: post.title,
    snippet:
      plainTextBody.substring(0, 150) +
      (plainTextBody.length > 150 ? "..." : ""),
    author: {
      name: getAuthorDisplayName(post.author),
    },
    tags: post.tags.map((tag) => tag.name),
    imageUrl: post.imageUrl || DEFAULT_BLOG_CARD_IMAGE,
    publishedAt: post.createdAt,
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
