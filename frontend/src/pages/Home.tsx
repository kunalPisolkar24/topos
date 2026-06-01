import React, { useState } from "react";
import { StickyNavbar } from "@/widgets";
import { BlogList } from "@/features/blog";
import { SearchBar } from "@/features/search";
import { ErrorBoundary } from "@/components/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const Home: React.FC = () => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const handleTagSelect = (tag: string | null) => {
    setSelectedTag(tag);
  };

  return (
    <div className="min-h-screen bg-zinc-900/20">
      <StickyNavbar />

      <main className="mx-auto md:pt-4 pt-8">
        <ErrorBoundary>
          <SearchBar onTagSelect={handleTagSelect} currentFilterTag={selectedTag} />
        </ErrorBoundary>

        {selectedTag && (
          <div className="container mx-auto px-4 max-w-7xl flex items-center justify-center mt-6">
            <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700 text-zinc-200 pl-3 pr-1 py-1 rounded-full text-sm">
              <span>Filtering by:</span>
              <Badge variant="secondary" className="bg-zinc-700 text-zinc-200">{selectedTag}</Badge>
              <Button onClick={() => handleTagSelect(null)} size="icon" variant="ghost" className="h-6 w-6 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <ErrorBoundary>
          <BlogList filterTag={selectedTag || undefined} />
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default Home;