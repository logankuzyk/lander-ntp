import type { Settings } from '@/settings/schema'

import type { PageValues } from './definition'

/** The settings that belong to the whole page, which any Widget may show. */
export const pageValues = (settings: Settings): PageValues => ({ hour12: settings.clock.hour12 })
