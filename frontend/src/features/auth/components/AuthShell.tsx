import type { PropsWithChildren, ReactNode, SVGProps } from "react";
import { Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/lib/cn";

export const authErrorClassName =
  "font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-destructive";

const authEyebrowClassName =
  "font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground";

interface AuthEyebrowProps extends PropsWithChildren {
  className?: string;
}

interface AuthSplitLayoutProps {
  heroTitle: ReactNode;
  heroDescription: ReactNode;
  heroStatus?: ReactNode;
  heroSubtitle?: ReactNode;
  sectionEyebrow: ReactNode;
  sectionTitle: ReactNode;
  sectionDescription: ReactNode;
  children: ReactNode;
  supplemental?: ReactNode;
  footer: ReactNode;
}

interface AuthGoogleButtonProps {
  label?: string;
}

export function AuthEyebrow({ children, className }: AuthEyebrowProps) {
  return <p className={cn(authEyebrowClassName, className)}>{children}</p>;
}

export function AuthDivider({ children }: PropsWithChildren) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-outline-variant/20" />
      <AuthEyebrow>{children}</AuthEyebrow>
      <span className="h-px flex-1 bg-outline-variant/20" />
    </div>
  );
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

export function AuthGoogleButton({
  label = "Continue with Google",
}: AuthGoogleButtonProps) {
  return (
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
        {label}
        <span className="ml-auto text-[0.625rem] tracking-[0.18em] text-muted-foreground/70">
          Soon
        </span>
      </span>
    </Button>
  );
}

export function AuthSplitLayout({
  heroTitle,
  heroDescription,
  heroStatus = "System status: operational",
  heroSubtitle = "Editorial workspace access",
  sectionEyebrow,
  sectionTitle,
  sectionDescription,
  children,
  supplemental,
  footer,
}: AuthSplitLayoutProps) {
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
                    {heroSubtitle}
                  </p>
                </div>
              </div>

              <div className="max-w-[28rem] space-y-6">
                <h1 className="text-[3.75rem] font-semibold leading-[0.92] tracking-[-0.05em] text-foreground">
                  {heroTitle}
                </h1>
                <p className="max-w-sm text-base leading-8 text-muted-foreground">
                  {heroDescription}
                </p>
              </div>
            </div>

            <div className="relative flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-2.5 w-2.5 bg-primary" />
              {heroStatus}
            </div>
          </section>

          <section className="bg-surface-lowest px-6 py-6 sm:mx-auto sm:w-full sm:max-w-xl sm:px-8 sm:py-8 lg:mx-0 lg:max-w-none lg:px-12 lg:py-12">
            <div className="space-y-8">
              <div className="space-y-4">
                <AuthEyebrow>{sectionEyebrow}</AuthEyebrow>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                    {sectionTitle}
                  </h2>
                  <p className="max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
                    {sectionDescription}
                  </p>
                </div>
              </div>

              {children}

              {supplemental}

              <div className="bg-surface px-5 py-5">{footer}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
