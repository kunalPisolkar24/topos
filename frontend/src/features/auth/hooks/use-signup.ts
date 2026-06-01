import { useMutation } from "@apollo/client/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { SignupDocument } from "@/shared/graphql/generated/graphql";
import { useToast } from "@/shared/ui/hooks/useToast";
import { useSessionActions } from "@/entities/session";
import { type ChangeEvent } from "react";
import { sanitizeUsernameInput } from "@/entities/user";
import { signupSchema, type SignupFormValues } from "@/schemas/auth/signup.schema";

export const useSignup = () => {
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
    handleUsernameChange,
    usernameField,
    onSubmit,
  };
};
