export const ICON_DATA_URL_LIMIT = 6_000
export const ICON_SIZE = 64

export type IconEncoder = {
  encode: (file: File, size: number, type: 'image/webp', quality: number) => Promise<Blob>
}

/** Draws an image into a transparent square without cropping and asks the browser for WebP. */
export const canvasIconEncoder: IconEncoder = {
  encode: async (file, size, type, quality) => {
    let image: ImageBitmap
    try {
      image = await createImageBitmap(file)
    } catch {
      throw new Error('Choose an image file.')
    }
    try {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const scale = Math.min(size / image.width, size / image.height)
      const width = image.width * scale
      const height = image.height * scale
      const context = canvas.getContext('2d')
      if (!context) throw new Error("This browser can't prepare the icon.")
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('No icon was made.'))),
          type,
          quality,
        )
      })
      return blob
    } finally {
      image.close()
    }
  },
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** Makes a small square icon suitable for one synced icon item. */
export async function encodeIcon(file: File, encoder: IconEncoder): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  let blob: Blob
  try {
    blob = await encoder.encode(file, ICON_SIZE, 'image/webp', 0.8)
  } catch (error) {
    if (error instanceof Error && error.message === 'Choose an image file.') throw error
    throw new Error("This browser can't make a small enough icon.")
  }
  if (blob.type !== 'image/webp' && blob.type !== 'image/png') {
    throw new Error("This browser can't make a small enough icon.")
  }
  const url = `data:${blob.type};base64,${base64(new Uint8Array(await blob.arrayBuffer()))}`
  if (url.length > ICON_DATA_URL_LIMIT) {
    if (blob.type === 'image/png') {
      throw new Error("This browser can't make this image small enough for sync.")
    }
    throw new Error('This icon is too big.')
  }
  return url
}
