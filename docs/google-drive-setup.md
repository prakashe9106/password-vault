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
   - Authorized redirect URIs: add the same origins again here (`http://localhost:5173`, and your
     production origin) — the app signs in via a full-page redirect (see below), which needs this
     exact-match field set, unlike the JavaScript-origins field above.
4. Copy the generated **Client ID** (looks like `1234567890-abc...apps.googleusercontent.com`).
5. In `apps/web/`, copy `.env.example` to `.env` and paste the Client ID:
   ```
   VITE_GOOGLE_CLIENT_ID=1234567890-abc...apps.googleusercontent.com
   ```
6. Restart the dev server (`pnpm --filter web dev`) so Vite picks up the new env var.

Until this is done, the app shows a "Google Drive isn't configured yet" screen instead of a
sign-in button — it doesn't need any of this to build or run its test suite.

No client secret is involved: sign-in uses OAuth 2.0 Implicit Grant via a full-page redirect (not
a popup — popup-based sign-in turned out to be unreliable across several real browser/network
environments during testing; Authorization Code + PKCE was also tried, but Google's "Web
application" client type requires a client secret for the code-exchange step even with PKCE, which
a backend-less static site can't keep). Implicit grant hands the access token back directly in the
redirect, with no exchange step and therefore no secret needed — the tradeoff is no refresh token,
so there's no true silent renewal of an expired token; a failed background sync just queues as
pending until the next active session, the same fallback already used for other sync failures.
