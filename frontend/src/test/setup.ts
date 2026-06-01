import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { apolloClient } from "@/shared/api";
import { resetSessionBootstrapForTests } from "@/lib/auth/session";
import { sessionStoreActions } from "@/stores/session-store";
import { server } from "./server";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  sessionStoreActions.resetForTests();
  resetSessionBootstrapForTests();
  await apolloClient.clearStore();
});

afterAll(() => {
  server.close();
});
