import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '@/settings/schema'
import { defaultOptions, readOptions } from '@/widgetSystem/options'

import { clockDefinition } from './definition'

const { showDate, showSeconds } = DEFAULT_SETTINGS.clock

describe('the Clock definition', () => {
  it('is stored as "clock" and called Clock', () => {
    expect(clockDefinition.type).toBe('clock')
    expect(clockDefinition.name).toBe('Clock')
  })

  it("starts a new Clock with the options today's settings default to", () => {
    expect(defaultOptions(clockDefinition)).toEqual({ showDate, showSeconds })
  })

  it('shows a Clock whose stored options are missing with those same defaults', () => {
    expect(readOptions(clockDefinition, {})).toEqual({ showDate, showSeconds })
    expect(readOptions(clockDefinition, undefined)).toEqual({ showDate, showSeconds })
  })

  it('reads the options a Clock was stored with', () => {
    expect(readOptions(clockDefinition, { showDate: true, showSeconds: true })).toEqual({
      showDate: true,
      showSeconds: true,
    })
    expect(readOptions(clockDefinition, { showDate: true })).toEqual({
      showDate: true,
      showSeconds,
    })
  })

  it('gives the Clock its defaults when an option is not a switch value', () => {
    expect(readOptions(clockDefinition, { showDate: 'yes', showSeconds: true })).toEqual({
      showDate,
      showSeconds,
    })
  })

  it("keeps 12/24-hour time as the page-wide value, never in the Clock's own options", () => {
    expect(readOptions(clockDefinition, { hour12: true, showDate: true })).toEqual({
      showDate: true,
      showSeconds,
    })
    expect(defaultOptions(clockDefinition)).not.toHaveProperty('hour12')
    expect(clockDefinition.options.find((option) => option.id === 'hour12')).toMatchObject({
      control: 'switch',
      shared: 'hour12',
    })
  })

  it("words its options as the settings panel does, with the page-wide switch last as the Weather's is", () => {
    expect(clockDefinition.options.map(({ id, label }) => [id, label])).toEqual([
      ['showDate', 'Show date'],
      ['showSeconds', 'Show seconds'],
      ['hour12', '24-hour time'],
    ])
  })

  it('marks "24-hour time" as the opposite of the hour12 it shows, so a form inverts it', () => {
    expect(clockDefinition.options.find((option) => option.id === 'hour12')).toMatchObject({
      invert: true,
    })
  })

  it('has no credit to give', () => {
    expect(clockDefinition.credit).toBeUndefined()
  })
})
