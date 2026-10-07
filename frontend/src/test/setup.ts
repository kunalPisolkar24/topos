import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import {
  resetSessionBootstrapForTests,
  sessionStoreActions,
} from "@/entities/session";
import { server } from "./server";

// jsdom lacks the pointer-capture and scroll APIs Radix controls call
// during open/select. Stub them once so dropdown-style primitives work
// under test without touching production code.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

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
