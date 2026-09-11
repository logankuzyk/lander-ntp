import * as v from 'valibot'

// Links end up as hrefs and image sources, so only allow http(s) (not `javascript:` etc.).
const HttpUrlSchema = v.pipe(
  v.string(),
  v.regex(/^https?:\/\//i, 'Expected an http(s) URL'),
  v.url(),
)

const SizeSchema = v.object({
  url: HttpUrlSchema,
  width: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

const PhotoSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  alt: v.nullable(v.string()),
  width: v.pipe(v.number(), v.minValue(1)),
  height: v.pipe(v.number(), v.minValue(1)),
  focalX: v.nullable(v.number()),
  focalY: v.nullable(v.number()),
  sizes: v.pipe(
    v.array(SizeSchema),
    v.minLength(1),
    v.transform((sizes) => [...sizes].sort((a, b) => a.width - b.width)),
  ),
  exif: v.object({
    camera: v.optional(v.string()),
    focalLength: v.optional(v.string()),
    aperture: v.optional(v.string()),
    shutter: v.optional(v.string()),
    iso: v.optional(v.string()),
    dateTaken: v.optional(v.string()),
  }),
  location: v.nullable(v.string()),
  pageUrl: HttpUrlSchema,
  printUrl: v.nullable(HttpUrlSchema),
})

/** Manifest v1 served by logankuzyk.com at /new-tab/photos.json. */
export const ManifestSchema = v.object({
  version: v.literal(1),
  generatedAt: v.string(),
  photos: v.array(PhotoSchema),
})

export type Manifest = v.InferOutput<typeof ManifestSchema>
export type Photo = Manifest['photos'][number]
