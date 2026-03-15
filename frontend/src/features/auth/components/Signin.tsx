import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
import { useSignin } from "../hooks/use-signin";
import { PasswordField } from "./PasswordField";

export const Signin = () => {
  const navigate = useNavigate();
  const { form, loading, onSubmit } =
    useSignin();

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
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...form.register("email")}
                className={`bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500 ${form.formState.errors.email
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

            <PasswordField
              id="password"
              label="Password"
              registration={form.register("password")}
              error={form.formState.errors.password?.message}
              rightLabel={
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs text-zinc-400 hover:text-zinc-300"
                  onClick={() => navigate("/forgot-password")}
                >
                  Forgot password?
                </Button>
              }
            />

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

