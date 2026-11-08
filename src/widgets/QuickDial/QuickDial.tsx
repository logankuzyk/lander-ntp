import { QuickDialTile } from '@/quickDial/QuickDialTile'

export type QuickDialProps = {
  colour?: string
  iconUrl?: (host: string) => string
  label: string
  newTab: boolean
  showIcon?: boolean
  uploadedIcon?: string | null
  url: string
}

export function QuickDial(props: QuickDialProps) {
  return <QuickDialTile {...props} />
}
