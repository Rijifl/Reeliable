import { AnalyzeReelRequest, AnalyzeReelResponse } from './types'

const SERVER_URL = 'http://localhost:3001'

export async function analyzeReel(
  req: AnalyzeReelRequest,
  signal?: AbortSignal,
): Promise<AnalyzeReelResponse> {
  const res = await fetch(`${SERVER_URL}/v1/analyze-reel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`analyze-reel failed: ${res.status} ${text}`)
  }
  return res.json()
}
