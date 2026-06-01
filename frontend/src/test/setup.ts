import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import {
  resetSessionBootstrapForTests,
  sessionStoreActions,
} from "@/entities/session";
import { server } from "./server";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  sessionStoreActions.resetForTests();
  resetSessionBootstrapForTests();
});

afterAll(() => {
  server.close();
});
