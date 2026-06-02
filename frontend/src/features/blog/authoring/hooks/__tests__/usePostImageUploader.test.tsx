import { act, renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import type ReactQuill from "react-quill-new";

const uploadMock = vi.fn();
const richTextUploadMock = vi.fn();

vi.mock("@/entities/upload", () => {
  const useImageUpload = () => ({
    upload: (file: File, options?: unknown) => uploadMock(file, options),
    richTextUpload: (file: File, options?: unknown) => richTextUploadMock(file, options),
    isUploading: false,
  });
  return { useImageUpload };
});

vi.mock("@/shared/ui/hooks/useToast", () => ({
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] }),
}));

import { usePostImageUploader } from "../usePostImageUploader";

const makeFile = (name: string, type = "image/png") =>
  new File([new Uint8Array([1, 2, 3])], name, { type });

const makeChangeEvent = (file: File | null) =>
  ({
    target: {
      files: file ? [file] : [],
    },
  }) as unknown as React.ChangeEvent<HTMLInputElement>;

function renderImageUploader(args?: Parameters<typeof usePostImageUploader>[0]) {
  return renderHook(() => usePostImageUploader(args ?? {}));
}

describe("usePostImageUploader", () => {
  beforeEach(() => {
    uploadMock.mockReset();
    richTextUploadMock.mockReset();
  });

  it("seeds state from initialImageUrl when provided", () => {
    const { result } = renderImageUploader({ initialImageUrl: "https://x/y.png" });
    expect(result.current.file).toBeNull();
    expect(result.current.url).toBe("https://x/y.png");
    expect(result.current.preview).toBe("https://x/y.png");
  });

  it("captures the selected file and clears the url in create mode", async () => {
    const { result } = renderImageUploader({ isEdit: false });
    const file = makeFile("card.png");

    act(() => {
      result.current.handleFileChange(makeChangeEvent(file));
    });

    await waitFor(() => {
      expect(result.current.file).toBe(file);
    });
    expect(result.current.url).toBeNull();
  });

  it("preserves the existing url in edit mode when a new file is selected", () => {
    const { result } = renderImageUploader({
      initialImageUrl: "https://x/old.png",
      isEdit: true,
    });
    const file = makeFile("card.png");

    act(() => {
      result.current.handleFileChange(makeChangeEvent(file));
    });

    expect(result.current.url).toBe("https://x/old.png");
    expect(result.current.file).toBe(file);
  });

  it("ignores change events without a selected file", () => {
    const { result } = renderImageUploader();
    act(() => {
      result.current.handleFileChange(makeChangeEvent(null));
    });
    expect(result.current.file).toBeNull();
  });

  it("returns null and shows a destructive toast when uploadCardImage is invoked without a file", async () => {
    const { result } = renderImageUploader();
    const url = await result.current.uploadCardImage();
    expect(url).toBeNull();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("uploads the selected file and stores the returned url", async () => {
    uploadMock.mockResolvedValueOnce("https://cloudinary/uploaded.png");
    const { result } = renderImageUploader();
    const file = makeFile("card.png");
    act(() => {
      result.current.handleFileChange(makeChangeEvent(file));
    });

    const url = await result.current.uploadCardImage();
    expect(url).toBe("https://cloudinary/uploaded.png");
    expect(uploadMock).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        loadingTitle: "Uploading Card Image...",
        successTitle: "Card Image Uploaded",
        errorTitle: "Card Image Upload Failed",
      }),
    );
    await waitFor(() => {
      expect(result.current.url).toBe("https://cloudinary/uploaded.png");
    });
  });

  it("exposes a mutable quill ref for the rich text editor", () => {
    const { result } = renderImageUploader();
    const ref: React.MutableRefObject<ReactQuill | null> = result.current.quillRef;
    expect(ref.current).toBeNull();
    ref.current = { getEditor: vi.fn() } as unknown as ReactQuill;
    expect(result.current.quillRef.current).not.toBeNull();
  });
});
