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
import { USERNAME_MAX_LENGTH } from "@/lib/user-input";
import { useSignup } from "../hooks/use-signup";
import { PasswordField } from "./PasswordField";

export const Signup = () => {
  const navigate = useNavigate();
  const {
    form,
    loading,
    handleUsernameChange,
    usernameField,
    onSubmit,
  } = useSignup();

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
                className={`text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500 ${form.formState.errors.email
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
                className={`text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-zinc-500 ${form.formState.errors.username
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

            <PasswordField
              id="password"
              label="Password"
              registration={form.register("password")}
              error={form.formState.errors.password?.message}
            />

            <PasswordField
              id="confirmPassword"
              label="Confirm Password"
              placeholder="Confirm your password"
              registration={form.register("confirmPassword")}
              error={form.formState.errors.confirmPassword?.message}
            />

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

