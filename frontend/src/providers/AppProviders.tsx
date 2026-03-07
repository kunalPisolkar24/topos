import { type PropsWithChildren } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/utils";
import { ThemeProvider } from "@/components/utils/theme-provider";
import { apolloClient } from "@/lib/apollo/client";
import { SessionBootstrap } from "./SessionBootstrap";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <ApolloProvider client={apolloClient}>
          <SessionBootstrap>
            <BrowserRouter>{children}</BrowserRouter>
            <Toaster />
          </SessionBootstrap>
        </ApolloProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
