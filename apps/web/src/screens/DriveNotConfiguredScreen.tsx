export default function DriveNotConfiguredScreen() {
  return (
    <div className="centered-screen">
      <div className="card" style={{ maxWidth: 480 }}>
        <h1>Google Drive isn't configured yet</h1>
        <p className="hint-text">
          This app stores your encrypted vault in your own Google Drive, which requires a Google
          OAuth Client ID that only a developer running this app locally can set up.
        </p>
        <p className="hint-text">
          See <code>docs/google-drive-setup.md</code> in the repo for the exact steps: create a
          Google Cloud project, configure the OAuth consent screen, create a Web application OAuth
          Client ID, and put it in <code>apps/web/.env</code> as <code>VITE_GOOGLE_CLIENT_ID</code>.
          Then restart the dev server.
        </p>
      </div>
    </div>
  );
}
