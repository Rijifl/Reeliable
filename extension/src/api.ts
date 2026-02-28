import { ProcessReelRequest, ProcessReelResponse } from './types'

const SERVER_URL = 'http://localhost:3001'

// Send full transcript to backend for processing
export async function processReel(req: ProcessReelRequest): Promise<ProcessReelResponse> {
  const res = await fetch(`${SERVER_URL}/v1/process-reel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`process-reel failed: ${res.status}`)
  return res.json()
}

// Check if a reel has already been processed (for prefetch cache hit)
export async function getCachedReel(reelId: string): Promise<ProcessReelResponse | null> {
  const res = await fetch(`${SERVER_URL}/v1/reel/${reelId}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`reel cache check failed: ${res.status}`)
  return res.json()
}
