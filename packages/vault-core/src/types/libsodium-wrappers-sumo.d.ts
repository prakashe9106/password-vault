/**
 * We use the "sumo" build at runtime (the standard build omits crypto_pwhash/Argon2id), but
 * DefinitelyTyped only publishes types under the "libsodium-wrappers" package name. The sumo
 * build is a strict superset of the standard build's API, so re-exporting those types here is
 * accurate for everything this codebase uses.
 */
declare module "libsodium-wrappers-sumo" {
  export * from "libsodium-wrappers";
}
