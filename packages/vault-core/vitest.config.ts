import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

// libsodium-wrappers-sumo@0.7.16's published ESM build imports a sibling package's file via a
// relative path ("./libsodium-sumo.mjs") that doesn't exist in its own directory - a packaging bug.
// Its CJS build has no such issue (it does a plain `require("libsodium-sumo")`), so we resolve the
// bare specifier straight to that working file, bypassing the broken "exports" -> "import" condition.
const require = createRequire(import.meta.url);
const libsodiumSumoCjsPath = require.resolve("libsodium-wrappers-sumo");

export default defineConfig({
  resolve: {
    alias: {
      "libsodium-wrappers-sumo": libsodiumSumoCjsPath,
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
