import { render } from "@testing-library/react";
import { ViewBlogPageSkeleton } from "../ViewBlogPageSkeleton";

describe("ViewBlogPageSkeleton", () => {
  it("renders the blog page skeleton without error", () => {
    const { container } = render(<ViewBlogPageSkeleton />);
    expect(container.querySelectorAll(".rounded-none").length).toBeGreaterThan(0);
  });
});
