import { useState } from "react";

interface Props {
  recoveryCode: string;
  onAcknowledged: () => void;
}

/**
 * Forces explicit acknowledgement before proceeding — per the PRD, losing both the master
 * password and this code means the vault is unrecoverable by design (no server-side backdoor).
 */
export default function RecoveryKeyDisplayScreen({ recoveryCode, onAcknowledged }: Props) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="centered-screen">
      <div className="card">
        <h1>Save your recovery key</h1>
        <p className="hint-text">
          If you forget your master password, this is the only other way to unlock your vault.
          Nobody else — including us — can recover it for you. Write it down and store it
          somewhere safe.
        </p>
        <div className="recovery-code">{recoveryCode}</div>
        <div className="checkbox-row">
          <input
            id="confirm-saved"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <label htmlFor="confirm-saved">I've saved my recovery key somewhere safe</label>
        </div>
        <button disabled={!confirmed} onClick={onAcknowledged}>
          Continue to my vault
        </button>
      </div>
    </div>
  );
}
