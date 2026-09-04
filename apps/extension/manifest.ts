import { defineManifest } from "@crxjs/vite-plugin";

/**
 * Local-only phase (see Phase 3 plan): no host_permissions at all — this build makes zero
 * network calls. content_scripts on <all_urls> is unavoidable for a password manager to detect
 * login forms anywhere; Chrome surfaces the standard "read and change data on all sites" notice
 * for that, which is inherent to the product, not scope creep.
 */
export default defineManifest({
  manifest_version: 3,
  name: "Privacy-First Password Vault",
  version: "0.1.0",
  description: "Local-only vault + autofill (dev build — no Google Drive sync yet).",
  action: {
    default_popup: "src/popup/index.html",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage", "activeTab"],
});
