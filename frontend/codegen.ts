import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: [
    "../services/user/schema.graphql",
    "../services/content/graph/schema.graphqls",
  ],
  documents: [
    "src/**/*.{graphql,ts,tsx}",
    "!src/shared/graphql/generated/**/*",
    // Preview-first review contract: unknown to the backend schema until it
    // adopts createContentDraft/resubmitContentDraft. Delete this exclusion
    // together with content-draft.documents.ts at that point.
    "!src/shared/graphql/content-draft.documents.ts",
  ],
  generates: {
    "./src/shared/graphql/generated/": {
      preset: "client",
      presetConfig: {
        fragmentMasking: false,
      },
      plugins: [],
    },
  },
  ignoreNoDocuments: false,
};

export default config;
