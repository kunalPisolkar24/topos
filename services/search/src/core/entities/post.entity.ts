export interface PostDocument {
  postId: string;
  title: string;
  body: string;
  authorName: string;
  imageUrl: string | null;
  createdAt: string; 
}