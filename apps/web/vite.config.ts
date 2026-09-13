import { createRequire } from "node:module";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// See packages/vault-core/vitest.config.ts for why this alias is needed:
// libsodium-wrappers-sumo@0.7.16's published ESM build has a broken relative import, so we point
// the bare specifier straight at its working CJS build instead.
const require = createRequire(import.meta.url);
const libsodiumSumoCjsPath = require.resolve("libsodium-wrappers-sumo");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "libsodium-wrappers-sumo": libsodiumSumoCjsPath,
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
