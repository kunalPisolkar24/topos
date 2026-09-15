import type React from "react";
import { StickyNavbar } from "@/widgets";
import ReviewQueueContent from "@/features/blog/review/ReviewQueuePage";

const ReviewQueuePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <StickyNavbar />
      <ReviewQueueContent />
    </div>
  );
};

export default ReviewQueuePage;
