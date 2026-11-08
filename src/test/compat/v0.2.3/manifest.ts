import * as v from 'valibot'

/** The v0.2.3 tag shape: unknown tag fields were ignored by its object schema. */
const TagSchema = v.object({ name: v.string(), slug: v.string() })

const PhotoSchema = v.object({
  alt: v.nullable(v.string()),
  exif: v.object({
    aperture: v.optional(v.string()),
    camera: v.optional(v.string()),
    dateTaken: v.optional(v.string()),
    focalLength: v.optional(v.string()),
    iso: v.optional(v.string()),
    shutter: v.optional(v.string()),
  }),
  focalX: v.nullable(v.number()),
  focalY: v.nullable(v.number()),
  height: v.number(),
  id: v.string(),
  location: v.nullable(v.string()),
  pageUrl: v.string(),
  printUrl: v.nullable(v.string()),
  sizes: v.array(v.object({ url: v.string(), width: v.number() })),
  tags: v.optional(v.array(TagSchema), []),
  width: v.number(),
})

/** The v0.2.3 manifest reader, frozen so the compatibility check stays independent. */
export const V023ManifestSchema = v.object({
  generatedAt: v.string(),
  photos: v.array(PhotoSchema),
  version: v.literal(1),
})
