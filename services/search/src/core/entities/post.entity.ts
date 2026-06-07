export interface PostDocument {
  postId: string;
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: string; 
  slug?: string;
  summary?: string;
}

export interface SearchResult {
  hits: PostDocument[];
  total: number;
}