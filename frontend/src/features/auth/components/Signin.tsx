import { Link } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./PasswordField";
import {
  AuthDivider,
  AuthGoogleButton,
  AuthSplitLayout,
  authErrorClassName,
} from "./AuthShell";
import { useSignin } from "../hooks/use-signin";

export const Signin = () => {
  const { form, loading, onSubmit } = useSignin();
  const { errors } = form.formState;

  return (
    <AuthSplitLayout
      heroTitle={
        <>
          Access your <span className="text-primary">writing</span> workspace.
        </>
      }
      heroDescription="Deploy, manage, and shape your publishing flow through one unified interface."
      sectionEyebrow="Member Access"
      sectionTitle="Welcome back"
      sectionDescription="Sign in to continue your storytelling journey through a calmer, sharper workspace."
      supplemental={
        <div className="space-y-4">
          <AuthDivider>Federated Access</AuthDivider>
          <div className="space-y-3">
            <AuthGoogleButton />
          </div>
        </div>
      }
      footer={
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Button
            asChild
            variant="link"
            className="h-auto p-0 text-sm"
          >
            <Link to="/signup">Sign up</Link>
          </Button>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "signin-email-error" : undefined}
            {...form.register("email")}
            className={errors.email ? "border-destructive" : undefined}
          />
          {errors.email && (
            <p id="signin-email-error" className={authErrorClassName}>
              {errors.email.message}
            </p>
          )}
        </div>

        <PasswordField
          id="password"
          label="Password"
          placeholder="Enter your password"
          registration={form.register("password")}
          error={errors.password?.message}
          errorId={errors.password ? "signin-password-error" : undefined}
          inputClassName={errors.password ? "border-destructive" : undefined}
          errorClassName={authErrorClassName}
          inputProps={{
            "aria-invalid": Boolean(errors.password),
            "aria-describedby": errors.password
              ? "signin-password-error"
              : undefined,
          }}
          rightLabel={
            <Button
              type="button"
              variant="ghost"
              disabled
              className="h-auto p-0 text-muted-foreground disabled:opacity-100"
            >
              Forgot password?
            </Button>
          }
        />

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing In...
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="transition-transform group-hover/button:translate-x-1" />
            </>
          )}
        </Button>
      </form>
    </AuthSplitLayout>
  );
};
