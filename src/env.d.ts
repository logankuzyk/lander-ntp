interface ImportMetaEnv {
  /** Override for the photo manifest endpoint, e.g. the local website in `.env.local`. */
  readonly WXT_PHOTO_MANIFEST_URL?: string
  /** Override for the telemetry endpoint, e.g. `wrangler dev` in `.env.local`. */
  readonly WXT_TELEMETRY_URL?: string
  /** Set to send telemetry from a dev build, which otherwise sends nothing. */
  readonly WXT_TELEMETRY_DEV?: string
}
