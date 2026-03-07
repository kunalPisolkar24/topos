import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../services/user/schema.graphql",
  documents: ["src/graphql/**/*.graphql"],
  generates: {
    "./src/graphql/generated/": {
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
