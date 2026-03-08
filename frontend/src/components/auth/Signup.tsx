import { useState, type ChangeEvent } from "react";
import { useMutation } from "@apollo/client/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignupDocument } from "@/graphql/generated/graphql";
import { useToast } from "@/hooks/use-toast";
import {
  USERNAME_MAX_LENGTH,
  sanitizeUsernameInput,
} from "@/lib/user-input";
import { useSessionActions } from "@/hooks/use-session-actions";

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

type SignupFormValues = z.infer<typeof signupSchema>;

export const Signup = () => {
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

  const handleSubmit = form.handleSubmit(async (values) => {
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
      console.error("Signup failed:", error);
    }
  });

  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = sanitizeUsernameInput(event.target.value);

    if (sanitizedValue !== event.target.value) {
      event.target.value = sanitizedValue;
    }

    usernameField.onChange(event);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-900/20 p-4">
      <Card className="w-full max-w-md border-zinc-800 shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
            Your Story Starts Here
          </CardTitle>
          <CardDescription className="pt-[10px] text-center text-zinc-400">
            Create an account to share your stories and insights.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...form.register("email")}
                className={`text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500 ${
                  form.formState.errors.email
                    ? "border-red-500"
                    : "border-zinc-800"
                }`}
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-sm text-red-500">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-zinc-300">
                Username
              </Label>
              <Input
                id="username"
                placeholder="Enter your username"
                maxLength={USERNAME_MAX_LENGTH}
                {...usernameField}
                onChange={handleUsernameChange}
                className={`text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500 ${
                  form.formState.errors.username
                    ? "border-red-500"
                    : "border-zinc-800"
                }`}
              />
              {form.formState.errors.username && (
                <p className="mt-1 text-sm text-red-500">
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  {...form.register("password")}
                  className={`pr-10 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500 ${
                    form.formState.errors.password
                      ? "border-red-500"
                      : "border-zinc-800"
                  }`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 text-zinc-400 hover:text-zinc-100"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {showPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
              {form.formState.errors.password && (
                <p className="mt-1 text-sm text-red-500">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-zinc-300">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  {...form.register("confirmPassword")}
                  className={`pr-10 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500 ${
                    form.formState.errors.confirmPassword
                      ? "border-red-500"
                      : "border-zinc-800"
                  }`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 text-zinc-400 hover:text-zinc-100"
                  onClick={() =>
                    setShowConfirmPassword((current) => !current)
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {showConfirmPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="mt-6 w-full transform bg-zinc-50 text-zinc-950 transition-all duration-200 hover:scale-[1.02] hover:bg-zinc-200"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing up...
                </>
              ) : (
                "Sign Up"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center border-t border-zinc-800 pt-4">
          <p className="text-sm text-zinc-400">
            Already have an account?{" "}
            <Button
              variant="link"
              className="p-0 text-zinc-300 hover:text-zinc-100"
              onClick={() => navigate("/signin")}
            >
              Sign in
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};
