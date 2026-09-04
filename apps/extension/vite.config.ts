import { createRequire } from "node:module";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./manifest";

// Same libsodium-wrappers-sumo fix as apps/web/vite.config.ts.
const require = createRequire(import.meta.url);
const libsodiumSumoCjsPath = require.resolve("libsodium-wrappers-sumo");

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "libsodium-wrappers-sumo": libsodiumSumoCjsPath,
    },
  },
});
