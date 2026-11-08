const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const LENGTH = 8
/** The largest multiple of the alphabet's size that a byte can hold. Bytes from here up are skipped. */
const USABLE = 256 - (256 % ALPHABET.length)

/**
 * A new id for a Widget: eight random lowercase letters and digits, and not one of `existing`,
 * so it is unique within the Layout. Random, so that two devices adding at once do not collide
 * on a counter.
 */
export function newId(existing: Iterable<string>): string {
  const taken = new Set(existing)
  for (;;) {
    let id = ''
    while (id.length < LENGTH) {
      const bytes = crypto.getRandomValues(new Uint8Array(16))
      for (const byte of bytes) {
        // A byte from 252 up would make the first four characters likelier than the others.
        if (byte < USABLE && id.length < LENGTH) id += ALPHABET[byte % ALPHABET.length]
      }
    }
    if (!taken.has(id)) return id
  }
}
