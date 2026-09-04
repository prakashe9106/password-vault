import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

// Same libsodium-wrappers-sumo fix as vite.config.ts / packages/vault-core/vitest.config.ts —
// @vault/core (pulled in transitively by syncStore.ts) needs it too.
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
    setupFiles: ["./test/setup.ts"],
  },
});
