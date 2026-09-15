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
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/main.tsx",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/test/**",
        "src/**/types.ts",
        "src/**/index.ts",
        "src/**/*.d.ts",
        "src/vite-env.d.ts",
        "src/shared/ui/primitives/**",
        "src/shared/ui/PagePagination.tsx",
        "src/shared/lib/cn.ts",
        "src/shared/lib/logger.ts",
        "src/shared/lib/storage.ts",
        "src/shared/api/httpClient.ts",
        "src/shared/ui/theme/**",
        "src/shared/graphql/generated/**",
        "src/entities/tag/model/**",
        "src/widgets/blog-author-sidebar/**",
        "src/features/blog/components/BlogTagSection.tsx",
        "src/features/blog/components/FeaturedImageSection.tsx",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
