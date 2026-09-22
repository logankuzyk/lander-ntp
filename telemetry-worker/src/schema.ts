import * as v from 'valibot'

const Text = (max: number) => v.pipe(v.string(), v.maxLength(max))

const Envelope = {
  installId: v.pipe(v.string(), v.uuid()),
  version: v.pipe(v.string(), v.regex(/^\d+\.\d+\.\d+$/)),
  browser: v.picklist(['chrome', 'firefox', 'edge']),
}

// Settings are free-form strings (with a length cap) rather than lists of the known values,
// so a new font or frequency in the extension doesn't start failing here. `v.object` drops
// keys it doesn't name, so nothing unexpected reaches the dataset either.
const Heartbeat = v.object({
  ...Envelope,
  event: v.literal('heartbeat'),
  props: v.object({
    photos: v.object({
      mode: Text(8),
      frequency: Text(16),
      tags: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1000)),
    }),
    font: Text(32),
    dim: v.boolean(),
    clock: v.object({
      enabled: v.boolean(),
      hour12: v.boolean(),
      showDate: v.boolean(),
      showSeconds: v.boolean(),
    }),
  }),
})

/** Everything the extension sends (src/telemetry/events.ts there). */
export const EventSchema = v.variant('event', [Heartbeat])

export type TelemetryEvent = v.InferOutput<typeof EventSchema>

/**
 * One Analytics Engine row. Queries address columns by position (blob1, double1, …), so
 * add to the end and never reorder; README.md lists what each one holds.
 */
export function toDataPoint(event: TelemetryEvent): AnalyticsEngineDataPoint {
  const { props } = event
  return {
    indexes: [event.installId],
    blobs: [
      event.event,
      event.browser,
      event.version,
      props.photos.mode,
      props.photos.frequency,
      props.font,
    ],
    doubles: [
      Number(props.dim),
      Number(props.clock.enabled),
      Number(props.clock.hour12),
      Number(props.clock.showDate),
      Number(props.clock.showSeconds),
      props.photos.tags,
    ],
  }
}
