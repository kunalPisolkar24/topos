import { type PropsWithChildren, useEffect } from "react";
import { useApolloClient } from "@apollo/client/react";
import { bootstrapSession } from "@/entities/session";

export function SessionBootstrap({ children }: PropsWithChildren) {
  const client = useApolloClient();

  useEffect(() => {
    void bootstrapSession(client);
  }, [client]);

  return <>{children}</>;
}
