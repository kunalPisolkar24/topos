import { SearchService } from '../services/search.service.js';
import { PostDocument } from '../../core/entities/post.entity.js';

interface Context {
	searchService: SearchService;
}

export const resolvers = {
	Query: {
		searchPosts: async (_: any, args: { query: string; page: number; limit: number }, context: Context) => {
			const { query, page, limit } = args;
			return context.searchService.searchPosts(query, page, limit);
		},
	},
	Post: {
		id: (root: PostDocument) => root.postId,
		title: (root: PostDocument) => root.title,
		summary: (root: PostDocument) => root.summary || root.body.substring(0, 150),
		slug: (root: PostDocument) => root.slug,
		authorName: (root: PostDocument) => root.authorName,
		createdAt: (root: PostDocument) => root.createdAt,
	},
};