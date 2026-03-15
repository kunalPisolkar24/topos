import type React from "react";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface BlogTitleSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export const BlogTitleSection: React.FC<BlogTitleSectionProps> = ({ value, onChange }) => {
  return (
    <Card className="bg-zinc-900/20 border-zinc-800 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-zinc-100 flex items-center">
          <FileText className="mr-2 h-5 w-5 text-zinc-400" />
          Blog Title
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          id="blogTitle"
          type="text"
          placeholder="Enter an engaging title for your blog post..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xl prose p-4 bg-zinc-800/20 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500"
          required
        />
      </CardContent>
    </Card>
  );
};
