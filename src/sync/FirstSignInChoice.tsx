export type FirstSignInChoiceValue = 'account' | 'browser'

export type FirstSignInSyncStatus = {
  needsChoice: boolean
}

type FirstSignInChoiceProps = {
  choose: (value: FirstSignInChoiceValue) => void
  syncStatus: FirstSignInSyncStatus
}

/** Ask which copy of the page to keep when a first sign-in finds two different Layouts. */
export function FirstSignInChoice({ choose, syncStatus }: FirstSignInChoiceProps) {
  if (!syncStatus.needsChoice) return null

  return (
    <section aria-labelledby="first-sign-in-choice-title" class="callout callout--first-sign-in">
      <div class="callout__header">
        <strong id="first-sign-in-choice-title">Choose which page to keep</strong>
      </div>
      <p>This choice covers every setting and the Layout.</p>
      <div class="first-sign-in-choice__actions">
        <button class="callout__action" onClick={() => choose('account')} type="button">
          Use your account's page
        </button>
        <button class="callout__action" onClick={() => choose('browser')} type="button">
          Keep this browser's
        </button>
      </div>
    </section>
  )
}
