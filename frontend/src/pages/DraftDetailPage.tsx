import type React from "react";
import { StickyNavbar } from "@/widgets";
import { DraftDetail } from "@/features/blog/review/DraftDetail";

const DraftDetailPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <StickyNavbar />
      <main className="container mx-auto px-4 pb-20 pt-app-navbar-offset sm:px-5 lg:px-6">
        <DraftDetail />
      </main>
    </div>
  );
};

export default DraftDetailPage;
