import type { PropsWithChildren, SVGProps } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./PasswordField";
import { useSignin } from "../hooks/use-signin";

const authErrorClassName =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-destructive";
const authEyebrowClassName =
  "font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground";

function Eyebrow({ children }: PropsWithChildren) {
  return <p className={authEyebrowClassName}>{children}</p>;
}

function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M21.805 12.23c0-.682-.061-1.338-.174-1.969H12v3.725h5.498a4.706 4.706 0 0 1-2.037 3.088v2.563h3.3c1.93-1.776 3.044-4.395 3.044-7.407Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.075-.915 6.766-2.475l-3.3-2.563c-.915.614-2.084.977-3.466.977-2.663 0-4.92-1.798-5.727-4.214H2.862v2.646A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.273 13.725A5.997 5.997 0 0 1 5.955 12c0-.599.103-1.181.318-1.725V7.63H2.862A10 10 0 0 0 2 12c0 1.611.385 3.137 1.067 4.37l3.206-2.645Z"
        fill="#FBBC04"
      />
      <path
        d="M12 6.062c1.5 0 2.846.516 3.907 1.53l2.93-2.93C17.07 3.014 14.755 2 12 2A10 10 0 0 0 2.862 7.63l3.41 2.645C7.08 7.86 9.337 6.062 12 6.062Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export const Signin = () => {
  const { form, loading, onSubmit } = useSignin();
  const { errors } = form.formState;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(77,68,227,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] opacity-30" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-10">
        <div className="grid w-full bg-surface ring-1 ring-outline-variant/20 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
          <section className="relative hidden min-h-[720px] overflow-hidden bg-surface-low px-12 pt-12 pb-6 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px] opacity-60" />
            <div className="relative space-y-20">
              <div className="inline-flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center bg-primary text-primary-foreground">
                  <Waypoints className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-foreground">
                    Topos
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Editorial workspace access
                  </p>
                </div>
              </div>

              <div className="max-w-[28rem] space-y-6">
                <h1 className="text-[3.75rem] font-semibold leading-[0.92] tracking-[-0.05em] text-foreground">
                  Access your{" "}
                  <span className="text-primary">writing</span>{" "}
                  workspace.
                </h1>
                <p className="max-w-sm text-base leading-8 text-muted-foreground">
                  Deploy, manage, and shape your publishing flow through one
                  unified interface.
                </p>
              </div>
            </div>

            <div className="relative flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-2.5 w-2.5 bg-primary" />
              System status: operational
            </div>
          </section>

          <section className="bg-surface-lowest px-6 py-6 sm:mx-auto sm:w-full sm:max-w-xl sm:px-8 sm:py-8 lg:mx-0 lg:max-w-none lg:px-12 lg:py-12">
            <div className="space-y-8">
              <div className="space-y-4">
                <Eyebrow>Member Access</Eyebrow>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                    Welcome back
                  </h2>
                  <p className="max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
                    Sign in to continue your storytelling journey through a
                    calmer, sharper workspace.
                  </p>
                </div>
              </div>

              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email"
                    {...form.register("email")}
                    className={errors.email ? "border-destructive" : undefined}
                  />
                  {errors.email && (
                    <p className={authErrorClassName}>{errors.email.message}</p>
                  )}
                </div>

                <PasswordField
                  id="password"
                  label="Password"
                  placeholder="Enter your password"
                  registration={form.register("password")}
                  error={errors.password?.message}
                  inputClassName={errors.password ? "border-destructive" : undefined}
                  errorClassName={authErrorClassName}
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

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-outline-variant/20" />
                  <Eyebrow>Federated Access</Eyebrow>
                  <span className="h-px flex-1 bg-outline-variant/20" />
                </div>

                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled
                    className="w-full justify-start text-muted-foreground disabled:cursor-not-allowed disabled:opacity-100"
                  >
                    <span className="flex w-full items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center">
                        <GoogleIcon className="h-4 w-4" />
                      </span>
                      Continue with Google
                      <span className="ml-auto text-[0.625rem] tracking-[0.18em] text-muted-foreground/70">
                        Soon
                      </span>
                    </span>
                  </Button>
                </div>
              </div>

              <div className="bg-surface px-5 py-5">
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
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
