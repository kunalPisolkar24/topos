import type { z } from "zod";

type ToastVariant = "default" | "destructive";

interface ToastInput {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
}

type Toast = (input: ToastInput) => void;

export const reportZodIssues = (
  toast: Toast,
  issues: z.ZodError["issues"],
  title = "Validation Error",
) => {
  issues.forEach((issue) => {
    toast({
      title,
      description: `${issue.path.join(".") || "value"} - ${issue.message}`,
      variant: "destructive",
    });
  });
};
