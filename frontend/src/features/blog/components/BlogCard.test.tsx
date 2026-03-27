import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { BlogCard } from "./BlogCard";

describe("BlogCard", () => {
  it("renders transformed Cloudinary sources and the refreshed editorial layout", () => {
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
        imageUrl="https://res.cloudinary.com/demo/image/upload/v1700000000/blog/post-1.png"
        publishedAt="2023-10-24T12:00:00.000Z"
      />,
    );
    const image = screen.getByRole("img", {
      name: /optimizing neural network/i,
    });
    const imageFrame = container.querySelector(
      '[data-slot="blog-card-image-frame"]',
    );
    const content = container.querySelector('[data-slot="blog-card-content"]');
    const title = container.querySelector('[data-slot="blog-card-title"]');

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
    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      "interactive-hover-structural",
    );
    expect(title).toHaveClass("line-clamp-2");
    expect(imageFrame).toHaveClass("md:col-start-2");
    expect(content).toHaveClass("md:col-start-1");
    expect(
      imageFrame?.compareDocumentPosition(content as Node),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(image).toHaveAttribute(
      "src",
      "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,f_auto,q_auto,dpr_auto,w_720,h_450/v1700000000/blog/post-1.png",
    );
    expect(image).toHaveAttribute(
      "srcset",
      "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,f_auto,q_auto,dpr_auto,w_480,h_300/v1700000000/blog/post-1.png 480w, https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,f_auto,q_auto,dpr_auto,w_720,h_450/v1700000000/blog/post-1.png 720w, https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,f_auto,q_auto,dpr_auto,w_960,h_600/v1700000000/blog/post-1.png 960w",
    );
    expect(image).toHaveAttribute(
      "sizes",
      "(max-width: 767px) calc(100vw - 2rem), (max-width: 1279px) 38vw, 360px",
    );
    expect(image).toHaveAttribute("width", "720");
    expect(image).toHaveAttribute("height", "450");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
  });

  it("keeps non-Cloudinary images unchanged", () => {
    renderWithProviders(
      <BlogCard
        id="post-2"
        title="Segment Trees Unpacked"
        snippet="When you need to answer queries about parts of an array quickly, segment trees come to the rescue."
        author={{ name: "Shamu22" }}
        tags={["Algorithms"]}
        imageUrl="https://images.example.com/post-2.jpg"
        publishedAt="2026-03-25T12:00:00.000Z"
      />,
    );

    const image = screen.getByRole("img", {
      name: /segment trees unpacked/i,
    });

    expect(image).toHaveAttribute("src", "https://images.example.com/post-2.jpg");
    expect(image).not.toHaveAttribute("srcset");
  });
});
