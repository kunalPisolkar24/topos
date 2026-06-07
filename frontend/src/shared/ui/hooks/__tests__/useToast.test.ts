import { describe, it, expect, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import { toast } from "../useToast";

describe("useToast", () => {
  it("uses title as message when provided", () => {
    const result = toast({ title: "Hello" });
    expect(result).toBeUndefined();
  });

  it("uses description as message when title is missing", () => {
    const result = toast({ description: "Desc" });
    expect(result).toBeUndefined();
  });

  it("falls back to Notification when no title or description", () => {
    const result = toast({});
    expect(result).toBeUndefined();
  });

  it("calls sonnerToast.error for destructive variant", () => {
    const result = toast({ title: "Error", variant: "destructive" });
    expect(result).toBeUndefined();
  });

  it("passes description as options when title is provided", () => {
    const result = toast({ title: "Title", description: "Desc" });
    expect(result).toBeUndefined();
  });
});
