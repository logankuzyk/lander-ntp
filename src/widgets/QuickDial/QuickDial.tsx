import { useEffect, useState } from 'preact/hooks'

import { readableInk } from '@/backdrop/readableInk'
import { useEditMode } from '@/components/EditMode/useEditMode'
import { siteIconUrl } from '@/quickDial/siteIconUrl'
import { tidyUrl } from '@/quickDial/tidyUrl'

export type QuickDialProps = {
  colour?: string
  iconUrl?: (host: string) => string
  label: string
  newTab: boolean
  showIcon?: boolean
  uploadedIcon?: string | null
  url: string
}

export function QuickDial({
  colour = '#ffffff',
  iconUrl = siteIconUrl,
  label,
  newTab,
  showIcon = true,
  uploadedIcon,
  url,
}: QuickDialProps) {
  const { editing } = useEditMode()
  const tidy = tidyUrl(url)
  const host = tidy ? new URL(tidy).hostname : ''
  const [failed, setFailed] = useState(false)
  const [uploadedFailed, setUploadedFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
    setUploadedFailed(false)
  }, [tidy, uploadedIcon])
  const title = label.trim() || host
  const stopInEdit = (event: Event) => {
    if (editing) event.preventDefault()
  }
  return (
    <a
      aria-label={title}
      class={`quick-dial${failed ? ' quick-dial--failed' : ''}`}
      href={tidy ?? undefined}
      onClick={stopInEdit}
      onKeyDown={(event) => {
        if (editing && event.key === 'Enter') event.preventDefault()
      }}
      rel={newTab ? 'noreferrer' : undefined}
      target={newTab ? '_blank' : undefined}
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
      <span class="quick-dial__label">{title}</span>
    </a>
  )
}
