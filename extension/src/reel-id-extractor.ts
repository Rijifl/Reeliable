/**
 * Reel ID Extractor
 *
 * Reads the stable shortcode + numeric media ID for an Instagram Reel by
 * walking the React Fiber tree upward from the <video> element.
 *
 * Data location (verified 2026-02):
 *   depth 31 · PolarisClipsDesktopVideoPlayer · memoizedProps
 *   { pk: '3841871309527101875', code: 'DVREZnVILGz', ... }
 */

// ─── Internal fiber types ────────────────────────────────────────────────────

interface FiberNode {
  type?: { displayName?: string; name?: string } | string | null
  memoizedProps?: Record<string, unknown> | null
  memoizedState?: HookNode | null
  return?: FiberNode | null
}

interface HookNode {
  memoizedState?: unknown
  next?: HookNode | null
}

interface SearchResult {
  shortcode?: string
  mediaId?: string
}

interface WalkResult {
  shortcode: string
  mediaId: string
  depth: number
}

// ─── Public types ────────────────────────────────────────────────────────────

export interface ReelIdentity {
  /** Base64url shortcode, e.g. "DVREZnVILGz" */
  shortcode: string
  /** Numeric media pk, e.g. "3841871309527101875" */
  mediaId: string
  /** Canonical reel URL */
  canonicalUrl: string
  /** Fiber depth at which the data was found (expected: 31) */
  fiberDepth: number
  /** Unix millisecond timestamp of extraction */
  extractedAt: number
}

// ─── Config ──────────────────────────────────────────────────────────────────

const WALK_CONFIG = {
  MAX_DEPTH: 65,
  COMPONENT_HINTS: new Set(['PolarisClipsDesktopVideoPlayer']),
  // Diagnostic confirmed depth 31; data propagates from depth 25 upward.
  // Range is intentionally wide to survive minor Instagram tree reshuffles.
  DEPTH_RANGE_HINT: { min: 22, max: 45 },
  // Props at depth 31 are flat (4 keys), but use 6 as buffer for extra wrapping.
  OBJECT_SEARCH_DEPTH: 6,
}

const SHORTCODE_RE = /^[A-Za-z0-9_-]{6,20}$/
const MEDIA_ID_RE  = /^\d{10,20}$/

// Priority order matters: confirmed keys first, ambiguous fallbacks last.
// `pk` (19 digits) wins over `id` (17-digit caption context id).
const SHORTCODE_KEY_PRIORITY = ['code', 'shortcode', 'reel_id', 'clip_id', 'mediaCode']
const MEDIA_ID_KEY_PRIORITY  = ['pk', 'media_id', 'mediaId', 'media_pk', 'id']

// ─── Core functions ───────────────────────────────────────────────────────────

export function getFiber(domNode: Element): FiberNode | null {
  const key = Object.keys(domNode).find(
    k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
  )
  return key ? (domNode as unknown as Record<string, FiberNode>)[key] : null
}

export function mediaIdToShortcode(mediaIdStr: string): string | null {
  try {
    const id = BigInt(mediaIdStr)
    const bytes = new Uint8Array(9)
    let rem = id
    for (let i = 8; i >= 0; i--) {
      bytes[i] = Number(rem & 0xffn)
      rem >>= 8n
    }
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/^A+/, '')
  } catch (e) {
    console.warn('[ReelIdExtractor] mediaIdToShortcode failed:', e)
    return null
  }
}

export function deepSearch(
  obj: unknown,
  remainingDepth: number,
  seen: WeakSet<object> = new WeakSet(),
): SearchResult {
  if (!obj || typeof obj !== 'object' || remainingDepth <= 0) return {}
  if (Array.isArray(obj) || obj instanceof Element) return {}
  if (seen.has(obj)) return {}
  seen.add(obj)

  const record = obj as Record<string, unknown>
  // 100-key cap — generous enough to handle Instagram's larger prop bags
  // while still guarding against walking store/registry-sized objects.
  if (Object.keys(record).length > 100) return {}

  let shortcode: string | undefined
  let mediaId: string | undefined

  for (const key of SHORTCODE_KEY_PRIORITY) {
    const val = record[key]
    if (typeof val === 'string' && SHORTCODE_RE.test(val)) { shortcode = val; break }
  }
  for (const key of MEDIA_ID_KEY_PRIORITY) {
    const val = record[key]
    if (typeof val === 'string' && MEDIA_ID_RE.test(val)) { mediaId = val; break }
  }

  if (shortcode && mediaId) return { shortcode, mediaId }

  for (const val of Object.values(record)) {
    if (!val || typeof val !== 'object' || Array.isArray(val) ||
        val instanceof Element || typeof val === 'function') continue
    const nested = deepSearch(val, remainingDepth - 1, seen)
    if (!shortcode && nested.shortcode) shortcode = nested.shortcode
    if (!mediaId  && nested.mediaId)   mediaId   = nested.mediaId
    if (shortcode && mediaId) break
  }

  return { shortcode, mediaId }
}

export function walkFiberTree(videoEl: HTMLVideoElement): WalkResult | null {
  let fiber = getFiber(videoEl)
  if (!fiber) {
    console.warn('[ReelIdExtractor] No fiber found on video element')
    return null
  }

  let depth = 0
  let bestShortcode: string | undefined
  let bestMediaId: string | undefined

  while (fiber && depth < WALK_CONFIG.MAX_DEPTH) {
    const type = fiber.type
    // Component names are minified in production (e.g. 'y' instead of
    // 'PolarisClipsDesktopVideoPlayer'). Treat the name hint as a bonus;
    // the depth range is the primary trigger for deep search.
    const name = (type && typeof type === 'object')
      ? (type.displayName ?? type.name ?? '')
      : ''

    const isHintedComponent = WALK_CONFIG.COMPONENT_HINTS.has(name)
    const isHintedDepth = depth >= WALK_CONFIG.DEPTH_RANGE_HINT.min &&
                          depth <= WALK_CONFIG.DEPTH_RANGE_HINT.max

    let result: SearchResult = {}

    if (isHintedComponent || isHintedDepth) {
      result = deepSearch(fiber.memoizedProps, WALK_CONFIG.OBJECT_SEARCH_DEPTH)

      // Walk the memoizedState hook linked list
      let hookNode: HookNode | null | undefined = fiber.memoizedState
      let hookCount = 0
      while (hookNode && hookCount < 50) {
        if (hookNode.memoizedState && typeof hookNode.memoizedState === 'object') {
          const stateResult = deepSearch(hookNode.memoizedState, WALK_CONFIG.OBJECT_SEARCH_DEPTH)
          if (!result.shortcode && stateResult.shortcode) result.shortcode = stateResult.shortcode
          if (!result.mediaId  && stateResult.mediaId)   result.mediaId   = stateResult.mediaId
        }
        hookNode = hookNode.next
        hookCount++
      }

      // Per-depth diagnostic: log what keys were present so we can spot
      // when Instagram renames or moves props.
      const propKeys = fiber.memoizedProps ? Object.keys(fiber.memoizedProps) : []
      console.debug(
        `[ReelIdExtractor] depth ${depth} (${name || 'anonymous'}) props: [${propKeys.join(', ')}]`,
        { foundShortcode: result.shortcode, foundMediaId: result.mediaId },
      )
    } else {
      result = deepSearch(fiber.memoizedProps, 2)
    }

    if (!bestShortcode && result.shortcode) bestShortcode = result.shortcode
    if (!bestMediaId   && result.mediaId)   bestMediaId   = result.mediaId

    if (bestShortcode && bestMediaId) {
      console.log(
        `[ReelIdExtractor] walkFiberTree: MATCH at depth ${depth} (${name || 'anonymous'})`,
        { shortcode: bestShortcode, mediaId: bestMediaId },
      )
      return { shortcode: bestShortcode, mediaId: bestMediaId, depth }
    }

    fiber = fiber.return ?? null
    depth++
  }

  console.warn('[ReelIdExtractor] walkFiberTree: not found within MAX_DEPTH',
    { reachedDepth: depth, bestShortcode, bestMediaId })
  return null
}

export function extractReelIdentity(articleEl: HTMLElement): ReelIdentity | null {
  const videoEl = articleEl.querySelector('video') as HTMLVideoElement | null
  if (!videoEl) {
    console.warn('[ReelIdExtractor] extractReelIdentity: no <video> in article')
    return null
  }

  const result = walkFiberTree(videoEl)
  if (!result) {
    // Fiber props may not be committed yet. Schedule three independent retries
    // so whichever fires first after React commits will succeed:
    //   1. loadstart  — blob URL assigned, React has set media props
    //   2. loadeddata — first frame decoded, definitely committed
    //   3. 100 ms timeout — catches cases where video is already buffered
    const retry = () => extractReelIdentity(articleEl)
    videoEl.addEventListener('loadstart',   retry, { once: true })
    videoEl.addEventListener('loadeddata',  retry, { once: true })
    setTimeout(retry, 100)
    console.debug('[ReelIdExtractor] extractReelIdentity: fiber not ready, retrying on loadstart/loadeddata/100ms')
    return null
  }

  const { shortcode, mediaId, depth } = result

  const computed = mediaIdToShortcode(mediaId)
  if (computed && computed !== shortcode) {
    console.warn('[ReelIdExtractor] extractReelIdentity: shortcode mismatch!',
      { fromFiber: shortcode, computedFromMediaId: computed, mediaId })
  }

  const identity: ReelIdentity = {
    shortcode,
    mediaId,
    canonicalUrl: `https://www.instagram.com/reel/${shortcode}/`,
    fiberDepth: depth,
    extractedAt: Date.now(),
  }

  console.log('[ReelIdExtractor] extractReelIdentity: success', identity)
  return identity
}

// ─── Debug poller ─────────────────────────────────────────────────────────────

/**
 * Continuously scans all <video> elements on the page and logs every
 * unique reel identity to the console. Intended for debug/development only.
 *
 * Queries <video> directly rather than wrapping <article> elements because
 * Instagram's reel layout does not consistently nest videos inside articles.
 *
 * @param intervalMs  How often to poll (default 2 s)
 * @returns           A stop function — call it to cancel the poller
 */
export function startDebugPoller(intervalMs = 2000): () => void {
  const seen = new Set<string>()

  const poll = () => {
    const videos = document.querySelectorAll<HTMLVideoElement>('video')

    // Always log the element count so we can confirm the poller can see the DOM
    console.log(`[ReelIdExtractor] poll: ${videos.length} video(s) on page`)

    videos.forEach((video, i) => {
      const result = walkFiberTree(video)
      if (!result) {
        console.log(`[ReelIdExtractor] video[${i}]: fiber walk returned null`)
        return
      }

      if (seen.has(result.shortcode)) return

      seen.add(result.shortcode)
      const computed = mediaIdToShortcode(result.mediaId)
      if (computed && computed !== result.shortcode) {
        console.warn('[ReelIdExtractor] shortcode mismatch!',
          { fromFiber: result.shortcode, computedFromMediaId: computed })
      }

      console.log(
        `[ReelIdExtractor] NEW reel #${seen.size}`,
        {
          shortcode:    result.shortcode,
          mediaId:      result.mediaId,
          canonicalUrl: `https://www.instagram.com/reel/${result.shortcode}/`,
          fiberDepth:   result.depth,
        },
      )
    })
  }

  const timerId = setInterval(poll, intervalMs)
  console.log(`[ReelIdExtractor] debug poller started — polling every ${intervalMs} ms`)

  return () => {
    clearInterval(timerId)
    console.log('[ReelIdExtractor] debug poller stopped')
  }
}
