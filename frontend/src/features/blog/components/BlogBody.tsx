import type React from "react";
import DOMPurify from "dompurify";
import { useNavigate } from "react-router-dom";

interface Tag {
  id: string;
  name: string;
}

interface BlogBodyProps {
  body: string;
  tags: Tag[];
}

export const BlogBody: React.FC<BlogBodyProps> = ({ body, tags }) => {
  const navigate = useNavigate();

  const cleanBody = DOMPurify.sanitize(body, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: [
      "allow", "allowfullscreen", "frameborder", "scrolling", "src",
      "width", "height", "title", "loading",
    ],
  });

  return (
    <article className="bg-surface-lowest p-4 ring-1 ring-outline-variant/20 sm:p-5 lg:p-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="h-2 w-2 bg-primary" aria-hidden="true" />
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
          Body
        </p>
      </div>
      <div className="bg-surface p-4 ring-1 ring-outline-variant/20 sm:p-5 lg:p-6">
        <div
          className="quill-content-view prose prose-lg dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: cleanBody }}
        />
      </div>
      {tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em]">
          {tags.map((tag) => (
            <button
              type="button"
              key={tag.id}
              className="interactive-hover-primary border border-outline-variant/20 bg-primary-container px-3 py-2 text-primary-foreground"
              onClick={() => navigate(`/search?q=${encodeURIComponent(tag.name)}`)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </article>
  );
};
