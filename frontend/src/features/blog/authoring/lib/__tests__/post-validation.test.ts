import { z } from "zod";
import { reportZodIssues } from "../post-validation";

const makeToast = () => vi.fn();

describe("reportZodIssues", () => {
  it("emits a destructive toast for every issue with a path and message", () => {
    const toast = makeToast();
    const schema = z.object({
      title: z.string().min(1, "Title is required"),
      body: z.string().min(1, "Body is required"),
    });
    const result = schema.safeParse({ title: "", body: "" });

    if (result.success) throw new Error("expected parse to fail");

    reportZodIssues(toast, result.error.issues);

    expect(toast).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenNthCalledWith(1, {
      title: "Validation Error",
      description: "title - Title is required",
      variant: "destructive",
    });
    expect(toast).toHaveBeenNthCalledWith(2, {
      title: "Validation Error",
      description: "body - Body is required",
      variant: "destructive",
    });
  });

  it("uses a custom title when provided", () => {
    const toast = makeToast();
    const schema = z.string().min(1, "required");
    const result = schema.safeParse("");
    if (result.success) throw new Error("expected parse to fail");

    reportZodIssues(toast, result.error.issues, "Save Failed");

    expect(toast).toHaveBeenCalledWith({
      title: "Save Failed",
      description: "value - required",
      variant: "destructive",
    });
  });
});
