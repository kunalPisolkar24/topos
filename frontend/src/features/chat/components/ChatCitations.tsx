import { Link } from "react-router-dom";

interface ChatCitationsProps {
  citedPostIds: string[];
}

export const ChatCitations: React.FC<ChatCitationsProps> = ({ citedPostIds }) => {
  if (citedPostIds.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Cited posts
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {citedPostIds.map((postId) => (
          <Link
            key={postId}
            to={`/blog/${postId}`}
            className="interactive-hover-primary border border-outline-variant/20 bg-surface-low px-2.5 py-1.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em] text-primary-foreground"
          >
            Post {postId.slice(0, 8)}
          </Link>
        ))}
      </div>
    </div>
  );
};
