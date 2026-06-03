import { Link } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USERNAME_MAX_LENGTH } from "@/entities/user";
import { useSignup } from "../hooks/use-signup";
import { PasswordField } from "./PasswordField";
import {
  AuthDivider,
  AuthGoogleButton,
  AuthSplitLayout,
  authErrorClassName,
} from "./AuthShell";

export const Signup = () => {
  const {
    form,
    loading,
    handleUsernameChange,
    usernameField,
    onSubmit,
  } = useSignup();
  const { errors } = form.formState;

  return (
    <AuthSplitLayout
      heroTitle={
        <>
          Build your <span className="text-primary">editorial</span> identity.
        </>
      }
      heroDescription="Create a workspace that is ready for drafting, publishing, and deliberate collaboration from day one."
      heroStatus="Provisioning flow: ready"
      sectionEyebrow="Account Setup"
      sectionTitle="Create your account"
      sectionDescription="Open a new workspace with the same precise tooling, calmer controls, and production-grade publishing foundation."
      supplemental={
        <div className="space-y-4">
          <AuthDivider>Federated Access</AuthDivider>
          <div className="space-y-3">
            <AuthGoogleButton label="Join with Google" />
          </div>
        </div>
      }
      footer={
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Button
            asChild
            variant="link"
            className="h-auto p-0 text-sm"
          >
            <Link to="/signin">Sign in</Link>
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
            aria-describedby={errors.email ? "signup-email-error" : undefined}
            {...form.register("email")}
            className={errors.email ? "border-destructive" : undefined}
          />
          {errors.email && (
            <p id="signup-email-error" className={authErrorClassName}>
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            placeholder="Choose a username"
            maxLength={USERNAME_MAX_LENGTH}
            aria-invalid={Boolean(errors.username)}
            aria-describedby={
              errors.username ? "signup-username-error" : "signup-username-hint"
            }
            {...usernameField}
            onChange={handleUsernameChange}
            className={errors.username ? "border-destructive" : undefined}
          />
          {errors.username ? (
            <p id="signup-username-error" className={authErrorClassName}>
              {errors.username.message}
            </p>
          ) : (
            <p
              id="signup-username-hint"
              className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Up to {USERNAME_MAX_LENGTH} characters. Extra spaces are trimmed
              automatically.
            </p>
          )}
        </div>

        <PasswordField
          id="password"
          label="Password"
          placeholder="Create a password"
          registration={form.register("password")}
          error={errors.password?.message}
          errorId={errors.password ? "signup-password-error" : undefined}
          inputClassName={errors.password ? "border-destructive" : undefined}
          errorClassName={authErrorClassName}
          inputProps={{
            autoComplete: "new-password",
            "aria-invalid": Boolean(errors.password),
            "aria-describedby": errors.password
              ? "signup-password-error"
              : undefined,
          }}
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm Password"
          placeholder="Confirm your password"
          registration={form.register("confirmPassword")}
          error={errors.confirmPassword?.message}
          errorId={
            errors.confirmPassword ? "signup-confirm-password-error" : undefined
          }
          inputClassName={
            errors.confirmPassword ? "border-destructive" : undefined
          }
          errorClassName={authErrorClassName}
          inputProps={{
            autoComplete: "new-password",
            "aria-invalid": Boolean(errors.confirmPassword),
            "aria-describedby": errors.confirmPassword
              ? "signup-confirm-password-error"
              : undefined,
          }}
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
              Signing up...
            </>
          ) : (
            <>
              Sign Up
              <ArrowRight className="transition-transform group-hover/button:translate-x-1" />
            </>
          )}
        </Button>
      </form>
    </AuthSplitLayout>
  );
};
