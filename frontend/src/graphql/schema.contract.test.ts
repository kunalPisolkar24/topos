import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("user schema contract", () => {
  it("includes updateProfile in the user subgraph SDL used by the gateway", () => {
    const schema = readFileSync(
      resolve(process.cwd(), "../services/user/schema.graphql"),
      "utf8",
    );

    expect(schema).toContain("updateProfile");
  });
});
