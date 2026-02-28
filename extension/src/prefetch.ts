// Prefetch manager — processes the next reel before the user scrolls to it
// When the user reaches it, verdicts are already cached server-side and returned instantly.
import { ProcessReelResponse, TranscriptSegment } from './types'
import { processReel, getCachedReel } from './api'

interface ReelInfo {
  id: string
  creator: string
}

// Local cache: reelId → results
const localCache = new Map<string, ProcessReelResponse>()

// Tracks which reels are currently being prefetched to avoid duplicate requests
const inFlight = new Set<string>()

// Called by content.ts when it detects the next reel in the DOM
export async function prefetchReel(reel: ReelInfo, transcript: TranscriptSegment[]) {
  if (localCache.has(reel.id) || inFlight.has(reel.id)) return

  inFlight.add(reel.id)
  try {
    // First check if server already has it cached
    const cached = await getCachedReel(reel.id)
    if (cached) {
      localCache.set(reel.id, cached)
      return
    }

    // Not cached — process it now in the background
    const result = await processReel({
      reelId: reel.id,
      creator: reel.creator,
      transcript,
    })
    localCache.set(reel.id, result)
  } catch (err) {
    console.warn('[prefetch] failed for reel', reel.id, err)
  } finally {
    inFlight.delete(reel.id)
  }
}

// Called by content.ts when the user lands on a reel — returns instantly if prefetched
export function getCached(reelId: string): ProcessReelResponse | null {
  return localCache.get(reelId) ?? null
}

export function setCached(reelId: string, result: ProcessReelResponse) {
  localCache.set(reelId, result)
}
