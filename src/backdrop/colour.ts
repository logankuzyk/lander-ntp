/** A six digit CSS colour, with or without the leading hash. */
export function parseColour(input: string): string | null {
  return /^#?[0-9a-fA-F]{6}$/.test(input) ? `#${input.replace(/^#/, '')}` : null
}
