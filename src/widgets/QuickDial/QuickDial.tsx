import { useEffect, useState } from 'preact/hooks'

import { useEditMode } from '@/components/EditMode/useEditMode'
import { siteIconUrl } from '@/quickDial/siteIconUrl'
import { tidyUrl } from '@/quickDial/tidyUrl'

export type QuickDialProps = {
  iconUrl?: (host: string) => string
  label: string
  newTab: boolean
  uploadedIcon?: string | null
  url: string
}

function colourFor(host: string): string {
  let hash = 0
  for (const character of host) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return `hsl(${Math.abs(hash) % 360} 48% 38%)`
}

export function QuickDial({
  iconUrl = siteIconUrl,
  label,
  newTab,
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
      <span class="quick-dial__icon" style={{ backgroundColor: colourFor(host) }}>
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
      <span class="quick-dial__label">{title}</span>
    </a>
  )
}
