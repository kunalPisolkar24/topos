import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppProviders } from "@/app/providers/AppProviders";
import { logger } from "@/shared/lib/logger";
import "./index.css";

async function bootstrap() {
  try {
    if (import.meta.env.VITE_ENABLE_MOCKS === "true") {
      const { worker } = await import("@/mocks/browser");
      await worker.start({ onUnhandledRequest: "bypass" });
    }
  } catch (err) {
    logger.error("MSW worker failed to start", err);
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  );
}

bootstrap().catch((err) => logger.error("Bootstrap failed", err));
