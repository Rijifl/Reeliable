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

export interface WalkResult {
  shortcode: string
  mediaId: string
  depth: number
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
