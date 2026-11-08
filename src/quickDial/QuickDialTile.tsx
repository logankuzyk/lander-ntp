import { useEffect, useState } from 'preact/hooks'

import { readableInk } from '@/backdrop/readableInk'
import { useEditMode } from '@/components/EditMode/useEditMode'
import { siteIconUrl } from '@/quickDial/siteIconUrl'
import { tidyUrl } from '@/quickDial/tidyUrl'

export type QuickDialTileProps = {
  colour?: string
  iconUrl?: (host: string) => string
  label: string
  newTab: boolean
  rel?: string
  showIcon?: boolean
  title?: string
  uploadedIcon?: string | null
  url: string
}

export function QuickDialTile({
  colour = '#ffffff',
  iconUrl = siteIconUrl,
  label,
  newTab,
  rel = 'noreferrer',
  showIcon = true,
  title,
  uploadedIcon,
  url,
}: QuickDialTileProps) {
  const { editing } = useEditMode()
  const tidy = tidyUrl(url)
  const host = tidy ? new URL(tidy).hostname : ''
  const [failed, setFailed] = useState(false)
  const [uploadedFailed, setUploadedFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
    setUploadedFailed(false)
  }, [tidy, uploadedIcon])
  const text = label.trim() || host
  const stopInEdit = (event: Event) => {
    if (editing) event.preventDefault()
  }
  return (
    <a
      aria-label={text}
      class={`quick-dial${failed ? ' quick-dial--failed' : ''}`}
      href={tidy ?? undefined}
      onClick={stopInEdit}
      onKeyDown={(event) => {
        if (editing && event.key === 'Enter') event.preventDefault()
      }}
      rel={newTab ? rel : undefined}
      target={newTab ? '_blank' : undefined}
      title={title}
    >
      {showIcon && (
        <span
          class="quick-dial__icon"
          style={failed ? { backgroundColor: colour, color: readableInk(colour) } : undefined}
        >
          {host && !failed ? (
            <img
              alt=""
              onError={() =>
                uploadedIcon && !uploadedFailed ? setUploadedFailed(true) : setFailed(true)
              }
              referrerPolicy="no-referrer"
              src={uploadedIcon && !uploadedFailed ? uploadedIcon : iconUrl(host)}
            />
          ) : (
            <span aria-hidden="true">{host.charAt(0).toUpperCase()}</span>
          )}
        </span>
      )}
      <span class="quick-dial__label">{text}</span>
    </a>
  )
}
