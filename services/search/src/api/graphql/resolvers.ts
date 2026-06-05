import { SearchService } from '../services/search.service.js';
import { PostDocument } from '../../core/entities/post.entity.js';

interface Context {
    searchService: SearchService;
}

export const resolvers = {
    Query: {
        searchPosts: async (
            _: unknown,
            args: { query: string; page: number; limit: number },
            context: Context
        ) => {
            return context.searchService.searchPosts(args.query, args.page, args.limit);
        },
    },
    Post: {
        id: (root: PostDocument) => root.postId,
    },
};
