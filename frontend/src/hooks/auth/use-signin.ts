import { useMutation } from "@apollo/client/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { SigninDocument } from "@/graphql/generated/graphql";
import { useToast } from "@/hooks/use-toast";
import { useSessionActions } from "@/hooks/use-session-actions";
import { useState } from "react";

const signinSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SigninFormValues = z.infer<typeof signinSchema>;

export const useSignin = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { authenticate } = useSessionActions();
  const [signin, { loading }] = useMutation(SigninDocument);

  const form = useForm<SigninFormValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const redirectTarget =
    (location.state as
      | {
          from?: { pathname?: string; search?: string; hash?: string };
        }
      | null)?.from;

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { data } = await signin({
        variables: values,
      });

      const payload = data?.signin;

      if (!payload) {
        throw new Error("Sign-in response was empty.");
      }

      authenticate(payload.token, payload.user);

      toast({
        title: "Success",
        description: "Successfully signed in.",
      });

      navigate(
        redirectTarget
          ? `${redirectTarget.pathname ?? ""}${redirectTarget.search ?? ""}${redirectTarget.hash ?? ""}`
          : "/",
        { replace: true },
      );
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Invalid credentials.",
      });
    }
  });

  return {
    form,
    loading,
    showPassword,
    togglePasswordVisibility,
    onSubmit,
  };
};
