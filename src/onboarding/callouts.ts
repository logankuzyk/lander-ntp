import type { SectionId } from '@/components/SettingsPanel/SettingsPanel'
import type { Settings } from '@/settings/schema'

import type { CalloutTarget } from './target'

type CalloutBase = {
  /** Whether the feature can be used at all right now. Checked once, before the note is shown. */
  available?: () => Promise<boolean>
  body: string
  /** Stored once dismissed, so never reuse one. */
  id: string
  /** False once there is nothing left to point out, such as a widget already switched on. */
  relevant?: (settings: Settings) => boolean
  title: string
}

/**
 * A short note about one part of the settings, drawn by components/Callout: a stop on the
 * settings panel's own tour, or news of something to set up there. It sits where the
 * `callout--<section>` rule in style.css puts it.
 */
export type SettingsStop = CalloutBase & {
  /** The settings section it is about. */
  section: SectionId
  target?: undefined
}

/**
 * A short note about something on the page itself, such as the Edit button or a Widget: placed
 * beside it by script, with a pointer at it, so it follows the thing if it moves (see
 * `CalloutTarget` and components/Callout). It needs no rule in style.css. Not drawn while its
 * target is not on the page; a news item that cannot be drawn is not used up, and holds the
 * ones behind it back (like one that is `available`), so that they keep their order.
 */
export type PageCallout = CalloutBase & {
  /** Label for starting a walk attached to this note. */
  actionLabel?: string
  section?: undefined
  /** For a one-step note, "Show me" goes into edit mode as it dismisses the note. */
  showMe?: 'edit'
  target: CalloutTarget
  /** The stops shown after its action is pressed. */
  walk?: readonly TourStop[]
}

export type CalloutInfo = PageCallout | SettingsStop

/** What the page is doing while a stop of the tour is up. */
export type PageState = {
  /** The Add menu is open. */
  adding: boolean
  /** The page is in edit mode. */
  editing: boolean
  /** Photo details are open without taking focus from the callout. */
  info?: boolean
}

/**
 * A stop of the tour on the page itself: placed beside its target like a piece of news. Next
 * brings the page to the next stop's `show`, so each stop is seen as it is described; nothing on
 * the Grid changes.
 */
export type PageTourStop = CalloutBase & {
  /**
   * Tells the person to change something on the page, so it is left out when the Layout cannot be
   * changed (a newer version of the page wrote it): the tour does not instruct what the page will
   * not do.
   */
  changes?: true
  /** The body for a Layout that cannot be changed, where the usual one says to change it. */
  readOnlyBody?: string
  section?: undefined
  /** What the page is doing while the stop is up. */
  show: PageState
  /**
   * What it points at: a target, `'widget'` for the first Widget on the page, whichever type that
   * is, or `'menu-item'` for the first item in the Add menu, which the stop opens (the note then
   * sits beside the menu: the menu opens upward from the Add button, and a note beside the button
   * would cover it).
   */
  target: 'menu-item' | 'widget' | CalloutTarget
  /** Said at the end of the body when the tour has no stop of its own for the setup button. */
  unlessSetup?: string
  /**
   * Only in the tour of a page that has this: a Widget (`widget`), or one waiting for the person
   * to set it up (`setup`). Otherwise the stop has nothing to point at and is left out.
   */
  when?: 'setup' | 'widget'
}

export type TourStop = PageTourStop | SettingsStop

/**
 * The tour a new install is offered after the welcome, in order: edit mode, moving and resizing
 * a Widget, a Widget's options, the setup button, the Add menu and Done on the page, then the
 * settings panel's Photos and Font (its own stops, drawn inside it: the Clock's and the
 * Weather's options are on their widgets). `planTour` picks the stops a page has. The words are
 * proposed, for the owner to review (LR-107).
 */
export const TOUR: readonly TourStop[] = [
  {
    body: 'Press Edit, or E on the keyboard, to move things around and change what is on your page.',
    id: 'tour-edit',
    readOnlyBody:
      'Press Edit, or E on the keyboard, to look at your page in edit mode. Update Lander to change it.',
    show: { adding: false, editing: false },
    target: 'edit',
    title: 'Edit your page',
  },
  {
    body: 'Drag a widget to move it, and drag the handle in its corner to resize it. From the keyboard, Tab to a widget, press Enter to pick it up, move it with the arrow keys (resize it with Shift and the arrows) and press Enter to put it down.',
    changes: true,
    id: 'tour-move',
    show: { adding: false, editing: true },
    target: 'widget',
    title: 'Move and resize',
    when: 'widget',
  },
  {
    body: 'Each widget has its own options. Press the button in its corner to change them.',
    changes: true,
    id: 'tour-options',
    show: { adding: false, editing: true },
    target: 'options',
    title: 'Options',
    when: 'widget',
  },
  {
    body: 'A widget that needs something from you, like a place for the weather, shows a button for it. Press that button to set it up.',
    changes: true,
    id: 'tour-setup',
    show: { adding: false, editing: true },
    target: 'setup',
    title: 'Set up a widget',
    when: 'setup',
  },
  {
    body: 'Pick a widget from the Add menu and it goes in the free spot nearest the middle.',
    changes: true,
    id: 'tour-add',
    show: { adding: true, editing: true },
    target: 'menu-item',
    title: 'Add a widget',
    unlessSetup:
      'One that needs something from you, like a place for the weather, shows a button to set it up.',
  },
  {
    body: 'Press Done, or E again, to leave edit mode. Each change is saved as you make it.',
    id: 'tour-done',
    show: { adding: false, editing: true },
    target: 'edit',
    title: 'When you are done',
  },
  {
    body: 'Choose how often the photo changes, and which tags to draw from. Or pick one from the gallery to keep.',
    id: 'tour-photos',
    section: 'photos',
    title: 'Photos',
  },
  {
    body: 'Set the font for the clock and everything around it.',
    id: 'tour-general',
    section: 'general',
    title: 'Font',
  },
]

/** The update note's walk, including the photo-details stop that only makes sense on the page. */
const NEWS_WALK: readonly TourStop[] = [
  ...TOUR.slice(0, 1),
  {
    body: 'Open photo details to see the camera settings and location for this photo.',
    id: 'news-photo-details',
    show: { adding: false, editing: false, info: true },
    target: 'edit',
    title: 'Photo details',
  },
  ...TOUR.slice(1),
]

/**
 * Shown once, one at a time and in this order, to people who had the extension before the
 * feature arrived. A new install never sees these (`recordInstall` records them as seen): the
 * tour covers the same ground. To announce a feature, add an entry here (and a stop in TOUR if it
 * earns one).
 *
 * `layout` is the one note for the update that put the page on a Layout. It sits at the Edit
 * button, which is always on the page once the Bottom bar has drawn, so it is not held back by a
 * missing target. Its words have to be true of every page that update leaves, down to one with
 * the Clock and the Weather both off, which is an empty Grid as before. The Weather's old news,
 * "New: weather", opened a settings tab that is gone now the Weather's options are on the widget,
 * so it was removed; its id stays in the `dismissed` list of anyone who saw it, and harms nothing
 * there. Do not reuse `weather` as an id.
 */
export const NEWS: readonly CalloutInfo[] = [
  {
    actionLabel: 'Show me',
    body: 'Move, resize and add widgets in edit mode. Clock and Weather options are on the widgets now, and Add brings back any you had off.',
    id: 'layout',
    target: 'edit',
    title: 'You can edit your page now',
    walk: NEWS_WALK,
  },
]

/** IDs for the New marks shown in the current release. Keep these stable once stored. */
export const MARKS = ['clock', 'weather-widget', 'photos', 'photo-heart'] as const
