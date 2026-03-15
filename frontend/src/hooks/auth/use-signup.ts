import { useMutation } from "@apollo/client/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { SignupDocument } from "@/graphql/generated/graphql";
import { useToast } from "@/hooks/use-toast";
import { useSessionActions } from "@/hooks/use-session-actions";
import { useState, type ChangeEvent } from "react";
import { USERNAME_MAX_LENGTH, sanitizeUsernameInput } from "@/lib/user-input";

const signupSchema = z
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

export const useSignup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { authenticate } = useSessionActions();
  const [signup, { loading }] = useMutation(SignupDocument);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const usernameField = form.register("username");

  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = sanitizeUsernameInput(event.target.value);
    if (sanitizedValue !== event.target.value) {
      event.target.value = sanitizedValue;
    }
    usernameField.onChange(event);
  };

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword((prev) => !prev);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { data } = await signup({
        variables: {
          email: values.email,
          username: sanitizeUsernameInput(values.username),
          password: values.password,
        },
      });

      const payload = data?.signup;

      if (!payload) {
        throw new Error("Signup response was empty.");
      }

      authenticate(payload.token, payload.user);

      toast({
        title: "Success",
        description: "Account created successfully.",
      });

      navigate("/", { replace: true });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Signup failed.",
      });
    }
  });

  return {
    form,
    loading,
    showPassword,
    showConfirmPassword,
    togglePasswordVisibility,
    toggleConfirmPasswordVisibility,
    handleUsernameChange,
    usernameField,
    onSubmit,
  };
};
