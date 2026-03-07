import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
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
import { SigninDocument } from "@/graphql/generated/graphql";
import { useToast } from "@/hooks/use-toast";
import { useSessionActions } from "@/hooks/use-session-actions";

const signinSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type SigninFormValues = z.infer<typeof signinSchema>;

export const Signin = () => {
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

  const handleSubmit = form.handleSubmit(async (values) => {
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
      console.error("Sign-in failed:", error);
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-900/20 p-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-950 shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
            Welcome Back
          </CardTitle>
          <CardDescription className="pt-[10px] text-center text-zinc-400">
            Sign in to continue your storytelling journey
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
                className={`bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500 ${
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-zinc-300">
                  Password
                </Label>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs text-zinc-400 hover:text-zinc-300"
                  onClick={() => navigate("/forgot-password")}
                >
                  Forgot password?
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  {...form.register("password")}
                  className={`bg-zinc-950 pr-10 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500 ${
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

            <Button
              type="submit"
              className="mt-6 w-full transform bg-zinc-50 text-zinc-950 transition-all duration-200 hover:scale-[1.02] hover:bg-zinc-200"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center border-t border-zinc-800 pt-4">
          <p className="text-sm text-zinc-400">
            Don't have an account?{" "}
            <Button
              variant="link"
              className="p-0 text-zinc-300 hover:text-zinc-100"
              onClick={() => navigate("/signup")}
            >
              Sign up
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};
