import { type PropsWithChildren } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/utils";
import { ThemeProvider } from "@/components/utils/theme-provider";
import { AppApolloProvider } from "./AppApolloProvider";
import { SessionBootstrap } from "./SessionBootstrap";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AppApolloProvider>
          <SessionBootstrap>
            <BrowserRouter>{children}</BrowserRouter>
            <Toaster />
          </SessionBootstrap>
        </AppApolloProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
