import { useState } from 'preact/hooks'

import { useEditMode } from '@/components/EditMode/useEditMode'
import type { Layout } from '@/layout/types'
import type { PageCallout, SettingsStop } from '@/onboarding/callouts'

import { Callout } from './Callout'
import { PageTour } from './PageTour'

type PageNewsProps = {
  closeInfo?: () => void
  /** Records that this one has been seen (it only ever gains the id). */
  dismiss: (id: string) => void
  layout: Layout
  news: PageCallout
  onWalkChange?: (walking: boolean) => void
  openInfo?: () => void
  openSettings?: (
    section: SettingsStop['section'],
    tour: { before: number; stops: readonly SettingsStop[]; total: number },
  ) => void
}

/**
 * News about a thing on the page, drawn beside it. "Show me" either starts its walk or, for a
 * one-step note with `showMe`, enters edit mode as it dismisses the note. It is drawn inside the
 * edit mode provider, which is why `App` itself cannot draw it.
 */
export function PageNews({
  closeInfo,
  dismiss,
  layout,
  news,
  onWalkChange,
  openInfo,
  openSettings,
}: PageNewsProps) {
  const { enter } = useEditMode()
  const [walking, setWalking] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const finish = () => {
    if (dismissed) return
    setDismissed(true)
    onWalkChange?.(false)
    dismiss(news.id)
  }
  if (walking && news.walk) {
    return (
      <PageTour
        closeInfo={closeInfo}
        layout={layout}
        onEnd={finish}
        onFinish={(plan) => {
          finish()
          const section = plan.settings[0]?.section
          if (section)
            openSettings?.(section, {
              before: plan.page.length,
              stops: plan.settings,
              total: plan.total,
            })
        }}
        openInfo={openInfo}
        stops={news.walk}
      />
    )
  }
  const action = news.walk
    ? {
        label: news.actionLabel ?? 'Show me',
        onClick: () => {
          setWalking(true)
          onWalkChange?.(true)
        },
      }
    : news.showMe === 'edit'
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
      : { label: 'Got it', onClick: () => finish() }

  return (
    <Callout
      action={action}
      body={news.body}
      layout={layout}
      onDismiss={finish}
      target={news.target}
      title={news.title}
    />
  )
}
