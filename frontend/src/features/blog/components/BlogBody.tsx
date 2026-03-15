import type React from "react";
import DOMPurify from "dompurify";
import { Badge } from "@/components/ui/badge";
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
        className="prose prose-lg dark:prose-invert max-w-none mb-8 quill-content-view text-zinc-200"
        dangerouslySetInnerHTML={{ __html: cleanBody }}
      />
      <div className="flex flex-wrap gap-2 mb-8">
        {tags.map((tag) => (
          <Badge 
            key={tag.id} 
            variant="secondary" 
            className="bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 transition-colors cursor-pointer" 
            onClick={() => navigate(`/tag/${tag.name}`)}
          >
            {tag.name}
          </Badge>
        ))}
      </div>
    </>
  );
};
