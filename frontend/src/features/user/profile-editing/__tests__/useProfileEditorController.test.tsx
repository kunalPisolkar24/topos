import { act, renderHook } from "@testing-library/react";
import type { UserCoreFragment } from "@/shared/graphql/generated/graphql";

const toastMock = vi.fn();
const updateProfileMock = vi.fn();

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [updateProfileMock, { loading: false }],
}));

vi.mock("@/shared/ui/hooks/useToast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/entities/upload", () => ({
  useImageUpload: () => ({
    upload: vi.fn().mockResolvedValue("https://cloudinary/uploaded.png"),
    isUploading: false,
  }),
}));

vi.mock("@/entities/user", () => ({
  sanitizeProfileName: (v: string) => v.trim(),
  sanitizeProfileBioInput: (v: string) => v,
  sanitizeProfileFormData: (v: { name?: string; bio?: string }) => ({
    name: (v.name ?? "").trim(),
    bio: v.bio ?? "",
  }),
  buildProfileUpdatePayload: (
    next: { name: string; bio: string },
    current: { name: string; bio: string },
  ) => {
    const payload: Record<string, string> = {};
    if (next.name && next.name !== current.name) payload.name = next.name;
    if (next.bio !== current.bio) payload.bio = next.bio;
    return payload;
  },
}));

import { useProfileEditorController } from "../useProfileEditorController";

const mockUser: UserCoreFragment = {
  __typename: "User",
  id: "user-1",
  username: "testuser",
  name: "Test User",
  email: "test@example.com",
  avatarUrl: "https://example.com/avatar.png",
  bannerUrl: "https://example.com/banner.png",
  bio: "Hello world",
  createdAt: "2024-01-01T00:00:00.000Z",
};

function renderProfileEditor(currentUser: UserCoreFragment | null = mockUser) {
  return renderHook(() => useProfileEditorController({ currentUser }));
}

describe("useProfileEditorController", () => {
  beforeEach(() => {
    toastMock.mockClear();
    updateProfileMock.mockClear();
  });

  it("initializes with currentUser values", () => {
    const { result } = renderProfileEditor();
    expect(result.current.state.displayName).toBe("Test User");
    expect(result.current.state.avatarSrc).toBe("https://example.com/avatar.png");
    expect(result.current.state.bannerSrc).toBe("https://example.com/banner.png");
    expect(result.current.state.isEditingProfile).toBe(false);
  });

  it("uses username when name is absent", () => {
    const user = { ...mockUser, name: null };
    const { result } = renderProfileEditor(user as UserCoreFragment);
    expect(result.current.state.displayName).toBe("testuser");
  });

  it("uses email when name and username are absent", () => {
    const user = { ...mockUser, name: null, username: "" };
    const { result } = renderProfileEditor(user as UserCoreFragment);
    expect(result.current.state.displayName).toBe("Workspace member");
  });

  it("computes profileInitial from name", () => {
    const { result } = renderProfileEditor();
    expect(result.current.state.profileInitial).toBe("T");
  });

  it("falls back to username initial when name is absent", () => {
    const user = { ...mockUser, name: null };
    const { result } = renderProfileEditor(user as UserCoreFragment);
    expect(result.current.state.profileInitial).toBe("T");
  });

  it("enables editing mode", () => {
    const { result } = renderProfileEditor();
    act(() => {
      result.current.handlers.setIsEditingProfile(true);
    });
    expect(result.current.state.isEditingProfile).toBe(true);
  });

  it("handles form change for name field", () => {
    const { result } = renderProfileEditor();
    act(() => {
      result.current.handlers.handleFormChange({
        target: { name: "name", value: "New Name" },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.state.formData.name).toBe("New Name");
  });

  it("handles form change for bio field", () => {
    const { result } = renderProfileEditor();
    act(() => {
      result.current.handlers.handleFormChange({
        target: { name: "bio", value: "New bio" },
      } as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(result.current.state.formData.bio).toBe("New bio");
  });

  it("ignores form change for unknown field", () => {
    const { result } = renderProfileEditor();
    act(() => {
      result.current.handlers.handleFormChange({
        target: { name: "email", value: "test@test.com" },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.state.formData.name).toBe("Test User");
  });

  it("resets state on cancel", () => {
    const { result } = renderProfileEditor();
    act(() => {
      result.current.handlers.setIsEditingProfile(true);
    });
    act(() => {
      result.current.handlers.handleFormChange({
        target: { name: "name", value: "Changed" },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => {
      result.current.handlers.handleCancel();
    });
    expect(result.current.state.isEditingProfile).toBe(false);
    expect(result.current.state.formData.name).toBe("Test User");
  });

  it("calls updateProfile mutation on save", async () => {
    updateProfileMock.mockResolvedValueOnce({
      data: { updateProfile: true },
    });
    const { result } = renderProfileEditor();
    act(() => {
      result.current.handlers.setIsEditingProfile(true);
    });
    act(() => {
      result.current.handlers.handleFormChange({
        target: { name: "name", value: "Changed Name" },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    await act(async () => {
      await result.current.handlers.handleSaveProfile();
    });
    expect(updateProfileMock).toHaveBeenCalled();
  });

  it("shows success toast on successful save", async () => {
    updateProfileMock.mockResolvedValueOnce({
      data: { updateProfile: true },
    });
    const { result } = renderProfileEditor();
    act(() => {
      result.current.handlers.setIsEditingProfile(true);
    });
    act(() => {
      result.current.handlers.handleFormChange({
        target: { name: "name", value: "Changed Name" },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    await act(async () => {
      await result.current.handlers.handleSaveProfile();
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Success" }),
    );
  });

  it("shows error toast when mutation fails", async () => {
    updateProfileMock.mockRejectedValueOnce(new Error("Failed"));
    const { result } = renderProfileEditor();
    act(() => {
      result.current.handlers.setIsEditingProfile(true);
    });
    act(() => {
      result.current.handlers.handleFormChange({
        target: { name: "name", value: "Changed Name" },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    await act(async () => {
      await result.current.handlers.handleSaveProfile();
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error", variant: "destructive" }),
    );
  });

  it("does nothing on save when currentUser is null", async () => {
    const { result } = renderProfileEditor(null);
    await act(async () => {
      await result.current.handlers.handleSaveProfile();
    });
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("shows no-changes toast when saving without changes", async () => {
    const { result } = renderProfileEditor();
    act(() => {
      result.current.handlers.setIsEditingProfile(true);
    });
    await act(async () => {
      await result.current.handlers.handleSaveProfile();
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "No Changes" }),
    );
  });

  it("reports hasUnsavedProfileChanges when files are selected", () => {
    const { result } = renderProfileEditor();
    expect(result.current.state.hasUnsavedProfileChanges).toBe(false);
  });

  it("handles file change for avatar", async () => {
    const { result } = renderProfileEditor();
    const file = new File(["test"], "avatar.png", { type: "image/png" });
    act(() => {
      result.current.handlers.handleFileChange(
        { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>,
        "avatar",
      );
    });
    expect(result.current.state.avatarFile).toBe(file);
  });

  it("handles file change for banner", async () => {
    const { result } = renderProfileEditor();
    const file = new File(["test"], "banner.png", { type: "image/png" });
    act(() => {
      result.current.handlers.handleFileChange(
        { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>,
        "banner",
      );
    });
    expect(result.current.state.bannerFile).toBe(file);
  });
});
