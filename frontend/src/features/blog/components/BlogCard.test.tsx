import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { BlogCard } from "./BlogCard";

describe("BlogCard", () => {
  it("renders the refreshed editorial layout without legacy metadata affordances", () => {
    const { container } = renderWithProviders(
      <BlogCard
        id="post-1"
        title="Optimizing Neural Network Throughput for Low-Latency Architectures"
        snippet="An exploration into kernel-level optimizations and strategic bypass patterns for inference workloads."
        author={{ name: "Marcus Thorne" }}
        tags={[
          "Architecture",
          "Neural Nets",
          "Low Latency",
          "Inference",
        ]}
        imageUrl="https://images.example.com/post-1.jpg"
        publishedAt="2023-10-24T12:00:00.000Z"
      />,
    );

    expect(
      screen.getByRole("link", {
        name: /open blog post: optimizing neural network throughput/i,
      }),
    ).toHaveAttribute("href", "/blog/post-1");
    expect(
      screen.getByText(
        "Optimizing Neural Network Throughput for Low-Latency Architectures",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "An exploration into kernel-level optimizations and strategic bypass patterns for inference workloads.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("#ARCHITECTURE")).toBeInTheDocument();
    expect(screen.getByText("#NEURAL_NETS")).toBeInTheDocument();
    expect(screen.getByText("#LOW_LATENCY")).toBeInTheDocument();
    expect(screen.getByText("+1 MORE")).toBeInTheDocument();
    expect(screen.getByText("Marcus Thorne")).toBeInTheDocument();
    expect(screen.getByText("OCT 24, 2023")).toBeInTheDocument();
    expect(screen.queryByText(/read more/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/min read/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ago/i)).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="avatar"]')).toBeNull();
    expect(screen.getByRole("img", { name: /optimizing neural network/i })).toBeInTheDocument();
  });
});
