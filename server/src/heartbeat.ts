export async function pingHeartbeat(
  url: string,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<void> {
  const response = await request(url, { signal })
  if (!response.ok) throw new Error(`Heartbeat returned status ${response.status}`)
}
