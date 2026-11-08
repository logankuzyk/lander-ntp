import { AwsClient } from 'aws4fetch'
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'

export type StoredObject = { key: string; lastModified?: Date }

export type ObjectStore = {
  delete: (key: string) => Promise<void>
  get: (key: string) => Promise<Uint8Array | undefined>
  list: (prefix?: string) => Promise<StoredObject[]>
  put: (key: string, value: Uint8Array) => Promise<void>
}

function safePath(root: string, key: string): string {
  if (!key || key.includes('\\') || key.startsWith('/')) throw new Error('Invalid object key')
  const path = resolve(root, key)
  const rel = relative(root, path)
  if (rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('Invalid object key')
  return path
}

async function walk(root: string, directory = root): Promise<StoredObject[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const objects: StoredObject[] = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) objects.push(...(await walk(root, path)))
    else if (entry.isFile()) {
      const details = await stat(path)
      objects.push({
        key: relative(root, path).split(sep).join('/'),
        lastModified: details.mtime,
      })
    }
  }
  return objects
}

export function createDirectoryObjectStore(root: string): ObjectStore {
  const absoluteRoot = resolve(root)
  return {
    delete: async (key) => {
      await rm(safePath(absoluteRoot, key), { force: true })
    },
    get: async (key) => {
      try {
        return new Uint8Array(await readFile(safePath(absoluteRoot, key)))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
        throw error
      }
    },
    list: async (prefix = '') => {
      await mkdir(absoluteRoot, { recursive: true })
      return (await walk(absoluteRoot)).filter((object) => object.key.startsWith(prefix))
    },
    put: async (key, value) => {
      const path = safePath(absoluteRoot, key)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, value)
    },
  }
}

export type R2Credentials = {
  accessKeyId: string
  accountId: string
  bucket: string
  secretAccessKey: string
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}

export function createR2ObjectStore(credentials: R2Credentials): ObjectStore {
  const client = new AwsClient({
    accessKeyId: credentials.accessKeyId,
    region: 'auto',
    secretAccessKey: credentials.secretAccessKey,
    service: 's3',
  })
  const endpoint = `https://${credentials.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(
    credentials.bucket,
  )}`
  const objectUrl = (key: string) =>
    `${endpoint}/${key.split('/').map(encodeURIComponent).join('/')}`
  const request = async (url: string, init?: RequestInit) => {
    const response = await client.fetch(url, init)
    if (!response.ok) throw new Error(`R2 request failed with status ${response.status}`)
    return response
  }

  return {
    delete: async (key) => {
      await request(objectUrl(key), { method: 'DELETE' })
    },
    get: async (key) => {
      const response = await client.fetch(objectUrl(key))
      if (response.status === 404) return undefined
      if (!response.ok) throw new Error(`R2 request failed with status ${response.status}`)
      return new Uint8Array(await response.arrayBuffer())
    },
    list: async (prefix = '') => {
      const objects: StoredObject[] = []
      let token: string | undefined
      do {
        const query = new URLSearchParams({ 'list-type': '2', prefix })
        if (token) query.set('continuation-token', token)
        const response = await request(`${endpoint}?${query}`)
        const xml = await response.text()
        objects.push(
          ...[...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, contents]) => {
            const key = contents?.match(/<Key>([\s\S]*?)<\/Key>/)?.[1]
            const modified = contents?.match(/<LastModified>([\s\S]*?)<\/LastModified>/)?.[1]
            if (!key) throw new Error('R2 returned an object without a key')
            return {
              key: decodeXml(key),
              ...(modified ? { lastModified: new Date(modified) } : {}),
            }
          }),
        )
        const truncated = xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/)?.[1] === 'true'
        const nextToken = xml.match(
          /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/,
        )?.[1]
        token = truncated && nextToken ? decodeXml(nextToken) : undefined
      } while (token)
      return objects
    },
    put: async (key, value) => {
      await request(objectUrl(key), { body: value.slice().buffer as ArrayBuffer, method: 'PUT' })
    },
  }
}
