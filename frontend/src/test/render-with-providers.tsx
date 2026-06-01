import type { PropsWithChildren, ReactNode } from "react";
import { useRef } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import type { ApolloClient } from "@apollo/client";
import { createApolloClient } from "@/shared/api";
import { env } from "@/lib/env";

type RenderOptions = {
  route?: string;
};

const noopUnauthorized = async () => {};

function Providers({
  children,
  route = "/",
}: PropsWithChildren<RenderOptions>) {
  const clientRef = useRef<ApolloClient | null>(null);
  if (clientRef.current === null) {
    clientRef.current = createApolloClient({
      uri: env.VITE_GRAPHQL_URL,
      getToken: () => null,
      onUnauthorized: noopUnauthorized,
    });
  }
  return (
    <ApolloProvider client={clientRef.current}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </ApolloProvider>
  );
}

export function renderWithProviders(
  ui: ReactNode,
  options?: RenderOptions,
) {
  return render(<Providers {...options}>{ui}</Providers>);
}
