import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
const libsodiumSumoCjsPath = require.resolve("libsodium-wrappers-sumo");

export default defineConfig({
  resolve: {
    alias: {
      "libsodium-wrappers-sumo": libsodiumSumoCjsPath,
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    // vaultSession tests do real Argon2id derivations (sometimes several per test, e.g. the
    // "restart survival" cases that reinitialize the WASM module via vi.resetModules()) —
    // matches the multi-second-per-test reality already seen in packages/vault-core's own suite.
    testTimeout: 60_000,
  },
});
