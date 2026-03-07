import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "import.meta.env.VITE_GRAPHQL_URL": JSON.stringify(
      "http://localhost:4000/graphql",
    ),
    "import.meta.env.VITE_BACKEND_URL": JSON.stringify(
      "http://localhost:8787",
    ),
    "import.meta.env.VITE_CLOUDINARY_CLOUD_NAME": JSON.stringify(""),
    "import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET": JSON.stringify(""),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
