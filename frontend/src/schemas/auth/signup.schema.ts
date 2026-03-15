import { z } from "zod";
import { USERNAME_MAX_LENGTH, sanitizeUsernameInput } from "@/lib/user-input";

export const signupSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    username: z
      .string()
      .transform(sanitizeUsernameInput)
      .pipe(
        z
          .string()
          .min(3, "Username must be at least 3 characters")
          .max(
            USERNAME_MAX_LENGTH,
            `Username must be ${USERNAME_MAX_LENGTH} characters or less`,
          ),
      ),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignupFormValues = z.infer<typeof signupSchema>;
