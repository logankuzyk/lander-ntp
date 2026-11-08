/** Choose the page ink with the higher WCAG contrast ratio against a six digit colour. */
export function readableInk(hex: string): '#111' | '#fff' {
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
  const contrast = (ink: number) =>
    (Math.max(luminance, ink) + 0.05) / (Math.min(luminance, ink) + 0.05)
  return contrast(0.0056) >= contrast(1) ? '#111' : '#fff'
}
