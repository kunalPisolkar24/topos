import { DEFAULT_BLOG_CARD_IMAGE } from "@/lib/content";
import {
  getBlogCardImageSources,
  getCloudinaryTransformedImageUrl,
} from "./cloudinary";

describe("cloudinary image delivery helpers", () => {
  it("transforms Cloudinary upload URLs with delivery-time resizing", () => {
    expect(
      getCloudinaryTransformedImageUrl(
        "https://res.cloudinary.com/demo/image/upload/v1700000000/blog/post-1.png",
        { width: 720, height: 450 },
      ),
    ).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,f_auto,q_auto,dpr_auto,w_720,h_450/v1700000000/blog/post-1.png",
    );
  });

  it("leaves non-Cloudinary URLs unchanged", () => {
    expect(
      getCloudinaryTransformedImageUrl(
        "https://images.example.com/post-1.jpg",
        { width: 720, height: 450 },
      ),
    ).toBe("https://images.example.com/post-1.jpg");
  });

  it("preserves default fallback image behavior for blog cards", () => {
    expect(getBlogCardImageSources(DEFAULT_BLOG_CARD_IMAGE)).toEqual({
      src: DEFAULT_BLOG_CARD_IMAGE,
      sizes:
        "(max-width: 767px) calc(100vw - 2rem), (max-width: 1279px) 38vw, 360px",
      width: 720,
      height: 450,
    });
  });
});
