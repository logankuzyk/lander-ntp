/** The viewfinder mark from the extension icon, in the colour of the text around it. */
export function Logo() {
  return (
    <svg
      aria-hidden="true"
      class="logo"
      fill="none"
      stroke="currentColor"
      stroke-width="20"
      viewBox="0 0 224 224"
    >
      <path d="M10 73V10h63M151 10h63v63M214 151v63h-63M73 214H10v-63" />
      <circle cx="112" cy="112" fill="currentColor" r="37" stroke="none" />
    </svg>
  )
}

/**
 * The mark and the name side by side. Everything is sized in em, so it scales as one piece
 * with the font size it is given, and it keeps its own typeface whatever font is chosen in
 * settings.
 */
export function Wordmark() {
  return (
    <span class="wordmark">
      <Logo />
      Lander
    </span>
  )
}
