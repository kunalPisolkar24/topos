import { z } from 'zod';
import type { PostDocument } from './post.entity.js';

const PASCAL_FIELDS = [
    'PostID',
    'Title',
    'Body',
    'ImageURL',
    'CreatedAt',
    'Slug',
    'Summary',
] as const;

const hasPascalShape = (record: Record<string, unknown>): boolean => {
    return PASCAL_FIELDS.some((field) => field in record);
};

const pascalToCamel = (record: Record<string, unknown>): Record<string, unknown> => ({
    postId: record.PostID,
    title: record.Title,
    body: record.Body,
    imageUrl: record.ImageURL,
    createdAt: record.CreatedAt,
    slug: record.Slug,
    summary: record.Summary,
});

const normalizeImageUrl = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
};

const PostEventBaseSchema = z.object({
    postId: z.string().min(1, 'postId is required'),
    title: z.string().min(1, 'title is required'),
    body: z.string().min(1, 'body is required'),
    imageUrl: z
        .unknown()
        .transform((v) => normalizeImageUrl(v))
        .optional()
        .default(null),
    createdAt: z.string().min(1, 'createdAt is required'),
    slug: z.string().optional(),
    summary: z.string().optional(),
});

export const PostEventSchema = z.preprocess((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
    }
    const record = value as Record<string, unknown>;
    if (hasPascalShape(record)) {
        return pascalToCamel(record);
    }
    return value;
}, PostEventBaseSchema);

export type PostEvent = z.infer<typeof PostEventBaseSchema>;

export const isPascalShape = (value: unknown): boolean => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    return hasPascalShape(value as Record<string, unknown>);
};

export const toPostDocument = (event: PostEvent): PostDocument => ({
    postId: event.postId,
    title: event.title,
    body: event.body,
    imageUrl: event.imageUrl ?? null,
    createdAt: event.createdAt,
    ...(event.slug !== undefined ? { slug: event.slug } : {}),
    ...(event.summary !== undefined ? { summary: event.summary } : {}),
});
