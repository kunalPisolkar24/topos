import { useMutation } from "@apollo/client/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { SigninDocument } from "@/shared/graphql/generated/graphql";
import { useToast } from "@/shared/ui/hooks/useToast";
import { useSessionActions } from "@/entities/session";
import { signinSchema, type SigninFormValues } from "@/schemas/auth/signin.schema";

export const useSignin = () => {
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
    onSubmit,
  };
};
