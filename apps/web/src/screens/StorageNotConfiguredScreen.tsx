export default function StorageNotConfiguredScreen() {
  return (
    <div className="centered-screen">
      <div className="card" style={{ maxWidth: 480 }}>
        <h1>Cloud storage isn't configured yet</h1>
        <p className="hint-text">
          This app stores your encrypted vault in your own Google Drive or Microsoft OneDrive,
          which requires an OAuth Client ID that only a developer running this app locally can set
          up — at least one of the two.
        </p>
        <p className="hint-text">
          See <code>docs/google-drive-setup.md</code> or <code>docs/onedrive-setup.md</code> in the
          repo for the exact steps. Put the resulting Client ID in <code>apps/web/.env</code> as
          <code> VITE_GOOGLE_CLIENT_ID</code> or <code>VITE_ONEDRIVE_CLIENT_ID</code>, then restart
          the dev server.
        </p>
      </div>
    </div>
  );
}
