import type { PropsWithChildren, ReactNode } from "react";
import { render } from "@testing-library/react";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import { apolloClient } from "@/lib/apollo/client";

type RenderOptions = {
  route?: string;
};

function Providers({
  children,
  route = "/",
}: PropsWithChildren<RenderOptions>) {
  return (
    <ApolloProvider client={apolloClient}>
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
