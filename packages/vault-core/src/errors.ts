export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class WrongPasswordError extends VaultError {
  constructor() {
    super("The provided secret could not unlock this envelope.");
  }
}

export class DecryptionFailedError extends VaultError {
  constructor() {
    super("Authenticated decryption failed — data is missing, corrupted, or tampered with.");
  }
}

export class CorruptContainerError extends VaultError {
  constructor(reason: string) {
    super(`Vault container is malformed: ${reason}`);
  }
}

export class VersionUnsupportedError extends VaultError {
  constructor(kind: "format_version" | "crypto_version", value: number) {
    super(`Unsupported ${kind}: ${value}`);
  }
}
