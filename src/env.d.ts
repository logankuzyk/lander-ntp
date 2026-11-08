interface ImportMetaEnv {
  /** Override for the photo manifest endpoint, e.g. the local website in `.env.local`. */
  readonly WXT_PHOTO_MANIFEST_URL?: string
  /** Override the account server address, e.g. in `.env.local`. */
  readonly WXT_SERVER_URL?: string
}
