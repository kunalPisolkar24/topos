import { type PropsWithChildren } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/shared/ui/primitives/toaster";
import { ErrorBoundary } from "@/app/providers/ErrorBoundary";
import { ThemeProvider } from "@/shared/ui/theme";
import { AppApolloProvider } from "./AppApolloProvider";
import { SessionBootstrap } from "./SessionBootstrap";
import { PreviewBanner } from "@/features/preview/components/PreviewBanner";
import { ScrollManager } from "@/app/routing/ScrollManager";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AppApolloProvider>
          <SessionBootstrap>
            <BrowserRouter>
              <ScrollManager />
              <PreviewBanner />
              {children}
            </BrowserRouter>
            <Toaster />
          </SessionBootstrap>
        </AppApolloProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
