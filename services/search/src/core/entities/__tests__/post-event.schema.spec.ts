import { describe, it, expect } from 'vitest';
import {
    PostEventSchema,
    isPascalShape,
    toPostDocument,
} from '../post-event.schema.js';

describe('PostEventSchema', () => {
    describe('PascalCase input', () => {
        it('maps PascalCase fields to camelCase and validates', () => {
            const result = PostEventSchema.safeParse({
                PostID: 'abc',
                Title: 'T',
                Body: 'B',
                CreatedAt: '2023-01-01',
                ImageURL: 'http://x.test/i.jpg',
                Slug: 's',
                Summary: 'sum',
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.postId).toBe('abc');
                expect(result.data.imageUrl).toBe('http://x.test/i.jpg');
                expect(result.data.slug).toBe('s');
                expect(result.data.summary).toBe('sum');
            }
        });

        it('detects PascalCase shape', () => {
            expect(isPascalShape({ PostID: '1' })).toBe(true);
            expect(isPascalShape({ Title: 'x' })).toBe(true);
            expect(isPascalShape({ Body: 'x' })).toBe(true);
            expect(isPascalShape({ postId: '1' })).toBe(false);
            expect(isPascalShape({ foo: 'bar' })).toBe(false);
            expect(isPascalShape(null)).toBe(false);
            expect(isPascalShape('string')).toBe(false);
            expect(isPascalShape([])).toBe(false);
        });
    });

    describe('camelCase input passthrough', () => {
        it('accepts camelCase fields directly when no PascalCase is present', () => {
            const result = PostEventSchema.safeParse({
                postId: '1',
                title: 'T',
                body: 'B',
                createdAt: '2023-01-01',
            });
            expect(result.success).toBe(true);
        });
    });

    describe('imageUrl normalization', () => {
        it('coerces empty/whitespace string to null', () => {
            const r1 = PostEventSchema.safeParse({
                PostID: '1',
                Title: 'T',
                Body: 'B',
                CreatedAt: '2023-01-01',
                ImageURL: '',
            });
            expect(r1.success).toBe(true);
            if (r1.success) expect(r1.data.imageUrl).toBeNull();

            const r2 = PostEventSchema.safeParse({
                PostID: '2',
                Title: 'T',
                Body: 'B',
                CreatedAt: '2023-01-01',
                ImageURL: '   ',
            });
            expect(r2.success).toBe(true);
            if (r2.success) expect(r2.data.imageUrl).toBeNull();
        });

        it('coerces non-string values (numbers, objects) to null', () => {
            const r = PostEventSchema.safeParse({
                PostID: '1',
                Title: 'T',
                Body: 'B',
                CreatedAt: '2023-01-01',
                ImageURL: 42,
            });
            expect(r.success).toBe(true);
            if (r.success) expect(r.data.imageUrl).toBeNull();
        });

        it('defaults to null when missing', () => {
            const r = PostEventSchema.safeParse({
                PostID: '1',
                Title: 'T',
                Body: 'B',
                CreatedAt: '2023-01-01',
            });
            expect(r.success).toBe(true);
            if (r.success) expect(r.data.imageUrl).toBeNull();
        });
    });

    describe('validation', () => {
        it('rejects missing required fields', () => {
            const r = PostEventSchema.safeParse({ PostID: '1' });
            expect(r.success).toBe(false);
        });

        it('rejects non-string required fields', () => {
            const r = PostEventSchema.safeParse({
                PostID: 1,
                Title: 'T',
                Body: 'B',
                CreatedAt: '2023-01-01',
            });
            expect(r.success).toBe(false);
        });
    });

    describe('toPostDocument', () => {
        it('projects a validated event to a PostDocument', () => {
            const r = PostEventSchema.parse({
                PostID: '1',
                Title: 'T',
                Body: 'B',
                CreatedAt: '2023-01-01',
                Slug: 's',
            });
            const doc = toPostDocument(r);
            expect(doc).toEqual({
                postId: '1',
                title: 'T',
                body: 'B',
                createdAt: '2023-01-01',
                imageUrl: null,
                slug: 's',
            });
            expect(doc).not.toHaveProperty('summary');
        });
    });
});
