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
    <>
      <div
        className="prose prose-lg dark:prose-invert max-w-none mb-8 quill-content-view"
        dangerouslySetInnerHTML={{ __html: cleanBody }}
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-2.5 mb-10 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-primary">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="cursor-pointer hover:text-primary/80 transition-colors"
              onClick={() => navigate(`/search?q=${encodeURIComponent(tag.name)}`)}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </>
  );
};
