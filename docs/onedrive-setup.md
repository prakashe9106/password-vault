# OneDrive setup (for local development)

The web app needs an Azure AD app registration to let it request `Files.ReadWrite.AppFolder`
access (and your basic profile, for display) to your personal OneDrive on your behalf. This is
the OneDrive analog of `docs/google-drive-setup.md` — only one of the two storage providers is
required for the app to be usable, so you only need to do this if you want OneDrive as an option.

1. Go to the [Azure Portal](https://portal.azure.com/) → **Azure Active Directory** → **App
   registrations** → **New registration**.
2. **Name**: anything (e.g. "Privacy-First Password Vault (dev)").
3. **Supported account types**: choose **"Personal Microsoft accounts only"** — this app targets
   personal vaults, not organization tenants (the same reason secure sharing and business admin
   are out of scope for now).
4. **Redirect URI**: platform **Single-page application (SPA)**, value `http://localhost:5173`
   (the Vite dev server's default origin). Add your production origin here too once you have one.
5. After creation, go to **API permissions** → **Add a permission** → **Microsoft Graph** →
   **Delegated permissions** → add `Files.ReadWrite.AppFolder` and `User.Read`. Both are
   consent-at-runtime delegated permissions — no admin consent is needed for a personal-account
   app.
6. Copy the **Application (client) ID** from the app registration's Overview page.
7. In `apps/web/`, copy `.env.example` to `.env` (if you haven't already) and paste the Client ID:
   ```
   VITE_ONEDRIVE_CLIENT_ID=00000000-0000-0000-0000-000000000000
   ```
8. Restart the dev server (`pnpm --filter web dev`) so Vite picks up the new env var.

Until this is done, OneDrive simply doesn't appear as a sign-in option on the connect-storage
screen — it doesn't need any of this to build or run its test suite. If neither this nor Google
Drive is configured, the app shows a "Cloud storage isn't configured yet" screen instead.

No client secret is involved: this app only ever runs MSAL's client-side authorization-code+PKCE
flow (`@azure/msal-browser`), never a server-side confidential-client flow, so nothing here is
sensitive enough to need a backend — consistent with how Google Drive is integrated.
