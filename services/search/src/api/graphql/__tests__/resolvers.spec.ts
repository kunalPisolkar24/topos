import { describe, it, expect } from 'vitest';
import { resolvers } from '../resolvers.js';
import { PostDocument } from '../../../core/entities/post.entity.js';

describe('GraphQL Resolvers', () => {
    describe('Query.searchPosts', () => {
        it('should call searchService with correct parameters', async () => {
            const mockSearchService = {
                searchPosts: vi.fn().mockResolvedValue({ hits: [], total: 0 })
            };
            const context = { searchService: mockSearchService };

            await resolvers.Query.searchPosts(
                {},
                { query: 'test', page: 1, limit: 10 },
                context as any
            );

            expect(mockSearchService.searchPosts).toHaveBeenCalledWith('test', 1, 10);
        });

        it('should cap limit at 50', async () => {
            const mockSearchService = {
                searchPosts: vi.fn().mockResolvedValue({ hits: [], total: 0 })
            };
            const context = { searchService: mockSearchService };

            await resolvers.Query.searchPosts(
                {},
                { query: 'test', page: 1, limit: 100 },
                context as any
            );

            expect(mockSearchService.searchPosts).toHaveBeenCalledWith('test', 1, 50);
        });

        it('should return search results', async () => {
            const expectedResult = { hits: [{ postId: '1', title: 'Test' }], total: 1 };
            const mockSearchService = {
                searchPosts: vi.fn().mockResolvedValue(expectedResult)
            };
            const context = { searchService: mockSearchService };

            const result = await resolvers.Query.searchPosts(
                {},
                { query: 'test', page: 1, limit: 10 },
                context as any
            );

            expect(result).toEqual(expectedResult);
        });
    });

    describe('Post field resolvers', () => {
        const mockPost: PostDocument = {
            postId: '123',
            title: 'Test Title',
            body: 'This is a test body content that is longer than 150 characters to test the summary fallback behavior when no summary is provided in the document.',
            imageUrl: 'http://example.com/image.jpg',
            createdAt: '2023-01-01',
            slug: 'test-slug',
            summary: 'Test Summary'
        };

        it('should resolve id from postId', () => {
            expect(resolvers.Post.id(mockPost)).toBe('123');
        });

        it('should resolve title', () => {
            expect(resolvers.Post.title(mockPost)).toBe('Test Title');
        });

        it('should resolve summary when present', () => {
            expect(resolvers.Post.summary(mockPost)).toBe('Test Summary');
        });

        it('should use body substring when summary is missing', () => {
            const postWithoutSummary: PostDocument = {
                ...mockPost,
                summary: undefined
            };

            const result = resolvers.Post.summary(postWithoutSummary);

            expect(result).toBe(mockPost.body.substring(0, 150));
        });

        it('should resolve slug', () => {
            expect(resolvers.Post.slug(mockPost)).toBe('test-slug');
        });

        it('should resolve imageUrl', () => {
            expect(resolvers.Post.imageUrl(mockPost)).toBe('http://example.com/image.jpg');
        });

        it('should resolve createdAt', () => {
            expect(resolvers.Post.createdAt(mockPost)).toBe('2023-01-01');
        });

        it('should handle null imageUrl', () => {
            const postWithNullImage: PostDocument = {
                ...mockPost,
                imageUrl: null
            };

            expect(resolvers.Post.imageUrl(postWithNullImage)).toBeNull();
        });
    });
});
