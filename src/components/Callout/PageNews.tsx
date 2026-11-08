import { useEditMode } from '@/components/EditMode/useEditMode'
import type { Layout } from '@/layout/types'
import type { PageCallout } from '@/onboarding/callouts'

import { Callout } from './Callout'

type PageNewsProps = {
  /** Records that this one has been seen (it only ever gains the id). */
  dismiss: (id: string) => void
  layout: Layout
  news: PageCallout
}

/**
 * News about a thing on the page, drawn beside it. Its button is "Got it", or "Show me" for news
 * that has `showMe`: that goes into edit mode as it dismisses the note, which is why this is
 * drawn inside the edit mode provider and `App` itself, which draws the provider, cannot do it.
 */
export function PageNews({ dismiss, layout, news }: PageNewsProps) {
  const { enter } = useEditMode()
  const action =
    news.showMe === 'edit'
      ? {
          label: 'Show me',
          onClick: () => {
            dismiss(news.id)
            enter()
            // The note is about to go, with focus on its button; the page's own button reads Done
            // now, and is where the keyboard carries on.
            document.querySelector<HTMLElement>('[data-edit-toggle]')?.focus()
          },
        }
      : { label: 'Got it', onClick: () => dismiss(news.id) }

  return (
    <Callout
      action={action}
      body={news.body}
      layout={layout}
      onDismiss={() => dismiss(news.id)}
      target={news.target}
      title={news.title}
    />
  )
}
