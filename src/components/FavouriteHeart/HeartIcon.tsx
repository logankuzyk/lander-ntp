/** A small, drawn heart shared by the photo detail and Gallery buttons. */
export function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      height="18"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.8"
      viewBox="0 0 24 24"
      width="18"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </svg>
  )
}
