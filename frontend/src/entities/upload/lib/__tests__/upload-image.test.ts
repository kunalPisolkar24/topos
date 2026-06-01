import axios from "axios";
import {
  cloudinaryImageProvider,
  type ImageProvider,
} from "../image-provider";
import { uploadImage } from "../upload-image";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockedPost = vi.mocked(axios.post);

const makeFile = (name = "photo.png"): File =>
  new File(["binary"], name, { type: "image/png" });

const validConfig = { cloudName: "demo", uploadPreset: "unsigned" };

describe("cloudinaryImageProvider", () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  it("defers construction-time validation until upload is called", () => {
    expect(() => cloudinaryImageProvider({ cloudName: "", uploadPreset: "" }))
      .not.toThrow();
  });

  it("rejects uploads when configuration is incomplete", async () => {
    const provider = cloudinaryImageProvider({
      cloudName: "",
      uploadPreset: "",
    });
    await expect(provider.upload(makeFile())).rejects.toThrow(
      /Cloudinary (configuration|upload preset) is missing/,
    );
  });

  it("uploads the file with multipart form data and returns the secure URL", async () => {
    mockedPost.mockResolvedValueOnce({ data: { secure_url: "https://res.cloudinary.com/demo/image/upload/v1/x.png" } });

    const provider = cloudinaryImageProvider(validConfig);
    const url = await provider.upload(makeFile());

    expect(url).toBe("https://res.cloudinary.com/demo/image/upload/v1/x.png");
    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [endpoint, body, config] = mockedPost.mock.calls[0]!;
    expect(endpoint).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("upload_preset")).toBe("unsigned");
    expect((body as FormData).get("file")).toBeInstanceOf(File);
    expect((config as { headers: Record<string, string> }).headers["Content-Type"])
      .toBe("multipart/form-data");
  });

  it("throws when the response does not include a secure URL", async () => {
    mockedPost.mockResolvedValueOnce({ data: {} });

    const provider = cloudinaryImageProvider(validConfig);
    await expect(provider.upload(makeFile())).rejects.toThrow(
      /Failed to get secure URL/,
    );
  });
});

describe("uploadImage", () => {
  const makeProvider = (impl: ImageProvider["upload"]): ImageProvider => ({
    upload: impl,
  });

  it("wraps a successful upload in an Ok result", async () => {
    const result = await uploadImage(
      makeFile(),
      makeProvider(async () => "https://cdn.example.com/a.png"),
    );

    expect(result).toEqual({
      ok: true,
      value: "https://cdn.example.com/a.png",
    });
  });

  it("wraps provider errors as Err with a NETWORK domain error", async () => {
    const result = await uploadImage(
      makeFile(),
      makeProvider(async () => {
        throw new Error("boom");
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NETWORK");
    expect(result.error.message).toBe("boom");
    expect(result.error.cause).toBeInstanceOf(Error);
  });

  it("uses a fallback message for non-Error throws", async () => {
    const result = await uploadImage(
      makeFile(),
      makeProvider(async () => {
        throw "raw";
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NETWORK");
    expect(result.error.message).toMatch(/unexpected upload error/);
  });
});
