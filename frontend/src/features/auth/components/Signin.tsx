import type { PropsWithChildren, SVGProps } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "./PasswordField";
import { useSignin } from "../hooks/use-signin";

const authLabelClassName =
  "font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-zinc-500";
const authFieldClassName =
  "h-12 rounded-none border-white/10 bg-[#1a1a1a] px-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#4d44e3] focus-visible:ring-1 focus-visible:ring-[#161138]";
const authErrorClassName =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[#c56a78]";

function Eyebrow({ children }: PropsWithChildren) {
  return <p className={authLabelClassName}>{children}</p>;
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
    <div className="relative min-h-screen overflow-hidden bg-[#1a1a1a] text-zinc-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(77,68,227,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] opacity-30" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-10">
        <div className="grid w-full lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
          <section className="relative hidden min-h-[720px] overflow-hidden bg-[#1b1d1d] px-12 py-12 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px] opacity-60" />
            <div className="relative space-y-20">
              <div className="inline-flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center bg-[#a9a1f7] text-[#111111]">
                  <Waypoints className="h-5 w-5 text-[#121212]" />
                </span>
                <div className="space-y-1">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-zinc-300">
                    Topos
                  </p>
                  <p className="text-sm text-zinc-500">
                    Editorial workspace access
                  </p>
                </div>
              </div>

              <div className="max-w-[28rem] space-y-6">
                <h1 className="text-[3.75rem] font-semibold leading-[0.92] tracking-[-0.05em] text-white">
                  Access your{" "}
                  <span className="text-[#b5b2ff]">writing</span>{" "}
                  workspace.
                </h1>
                <p className="max-w-sm text-base leading-8 text-zinc-500">
                  Deploy, manage, and shape your publishing flow through one
                  unified interface.
                </p>
              </div>
            </div>

            <div className="relative flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-zinc-500">
              <span className="h-2.5 w-2.5 bg-[#b5b2ff]" />
              System status: operational
            </div>
          </section>

          <section className="bg-[#050505]/95 px-6 py-6 ring-1 ring-white/10 sm:mx-auto sm:w-full sm:max-w-xl sm:px-8 sm:py-8 lg:mx-0 lg:max-w-none lg:px-12 lg:py-12">
            <div className="space-y-8">
              <div className="space-y-4">
                <Eyebrow>Member Access</Eyebrow>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                    Welcome back
                  </h2>
                  <p className="max-w-md text-sm leading-7 text-zinc-400 sm:text-base">
                    Sign in to continue your storytelling journey through a
                    calmer, sharper workspace.
                  </p>
                </div>
              </div>

              <form onSubmit={onSubmit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email" className={authLabelClassName}>
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email"
                    {...form.register("email")}
                    className={`${authFieldClassName} ${
                      errors.email ? "border-[#9e3f4e]" : ""
                    }`}
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
                  labelClassName={authLabelClassName}
                  inputClassName={`${authFieldClassName} ${
                    errors.password ? "border-[#9e3f4e]" : ""
                  }`}
                  toggleClassName="absolute right-0 top-0 h-full w-12 rounded-none border-l border-white/10 px-0 text-zinc-500 transition hover:bg-white/[0.03] hover:text-zinc-100 focus-visible:border-[#4d44e3] focus-visible:ring-1 focus-visible:ring-[#161138]"
                  errorClassName={authErrorClassName}
                  rightLabel={
                    <Button
                      type="button"
                      variant="ghost"
                      disabled
                      className="h-auto rounded-none p-0 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-zinc-500 disabled:opacity-100"
                    >
                      Forgot password?
                    </Button>
                  }
                />

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-none border border-transparent bg-[#4d44e3] px-4 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-white hover:bg-[#5a52ef] focus-visible:border-[#4d44e3] focus-visible:ring-1 focus-visible:ring-[#161138] disabled:bg-[#312d69] disabled:text-zinc-300"
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
                  <span className="h-px flex-1 bg-white/10" />
                  <Eyebrow>Federated Access</Eyebrow>
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled
                    className="h-12 w-full rounded-none border-white/10 bg-[#1a1a1a] px-4 font-mono text-[0.75rem] uppercase tracking-[0.16em] text-zinc-500 hover:bg-[#1a1a1a] hover:text-zinc-500 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-[#1a1a1a] disabled:text-zinc-500 disabled:opacity-100"
                  >
                    <span className="flex w-full items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center">
                        <GoogleIcon className="h-4 w-4" />
                      </span>
                      Continue with Google
                      <span className="ml-auto text-[0.625rem] tracking-[0.18em] text-zinc-600">
                        Soon
                      </span>
                    </span>
                  </Button>
                </div>
              </div>

              <div className="bg-[#1b1b1b] px-5 py-5">
                <p className="text-sm text-zinc-400">
                  Don&apos;t have an account?{" "}
                  <Button
                    asChild
                    variant="link"
                    className="h-auto rounded-none p-0 text-sm text-[#8f8aff] hover:text-[#b5b2ff]"
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
