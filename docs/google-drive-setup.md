# Google Drive setup (for local development)

The web app needs a Google OAuth Client ID to let it request `drive.file` access (and your email,
for display) on your behalf. This only needs to be done once per developer environment.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project (or
   pick an existing one) — top-left project selector → "New Project".
2. **Configure the OAuth consent screen**: APIs & Services → OAuth consent screen.
   - User type: "External" is fine for development.
   - App name: anything (e.g. "Privacy-First Password Vault (dev)").
   - Scopes: you don't need to add scopes here — the app requests them at runtime
     (`drive.file`, `userinfo.email`, `userinfo.profile`).
   - Test users: while the app is in "Testing" publishing status, add your own Google account
     email here, or sign-in will be blocked.
3. **Create credentials**: APIs & Services → Credentials → "Create Credentials" → "OAuth client ID".
   - Application type: **Web application**.
   - Authorized JavaScript origins: add `http://localhost:5173` (the Vite dev server's default
     origin). Add your production origin here too once you have one.
   - Leave "Authorized redirect URIs" empty — the client-side token flow this app uses doesn't
     redirect.
4. Copy the generated **Client ID** (looks like `1234567890-abc...apps.googleusercontent.com`).
5. In `apps/web/`, copy `.env.example` to `.env` and paste the Client ID:
   ```
   VITE_GOOGLE_CLIENT_ID=1234567890-abc...apps.googleusercontent.com
   ```
6. Restart the dev server (`pnpm --filter web dev`) so Vite picks up the new env var.

Until this is done, the app shows a "Google Drive isn't configured yet" screen instead of a
sign-in button — it doesn't need any of this to build or run its test suite.

No client secret is involved: this app only ever runs Google's client-side token flow (Google
Identity Services), never the server-side authorization-code flow, so nothing here is sensitive
enough to need a backend.
