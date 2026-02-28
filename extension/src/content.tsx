import { TranscriptSegment } from './types'
import { processReel } from './api'
import { prefetchReel, getCached, setCached } from './prefetch'
import { ReelCheckOverlay } from './overlay'

const log = (...args: unknown[]) => console.log('[ReelCheck]', ...args)

log('content script loaded', window.location.href)

// ── State ─────────────────────────────────────────────────────────────────────

let currentReelId: string | null = null
let videoTimeInterval: ReturnType<typeof setInterval> | null = null
let overlay: ReelCheckOverlay | null = null
let activeVideo: HTMLVideoElement | null = null
let positionCleanup: (() => void) | null = null

// ── Overlay position tracking ─────────────────────────────────────────────────

function startPositionTracking(video: HTMLVideoElement) {
  stopPositionTracking()

  const update = () => {
    if (overlay && video.isConnected) {
      overlay.updatePosition(video.getBoundingClientRect())
    }
  }

  update() // immediate first paint

  const ro = new ResizeObserver(update)
  ro.observe(video)

  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update, { passive: true })

  positionCleanup = () => {
    ro.disconnect()
    window.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
  }
}

function stopPositionTracking() {
  positionCleanup?.()
  positionCleanup = null
}

// ── Instagram DOM detection ───────────────────────────────────────────────────

/**
 * Returns the video element most visible in the viewport, or null if none.
 * Uses getBoundingClientRect intersection area as the visibility score.
 * Tries multiple selectors so Instagram DOM changes don't silently break detection.
 */
function getMostVisibleVideo(): HTMLVideoElement | null {
  // Try progressively broader selectors — Instagram may or may not use playsinline
  const videos = Array.from(
    document.querySelectorAll<HTMLVideoElement>(
      'video[playsinline], video[autoplay], video[src], video'
    )
  ).filter((v, i, arr) => arr.indexOf(v) === i) // dedupe (querySelectorAll won't dedupe across selectors)
  log(`getMostVisibleVideo: found ${videos.length} video elements`)
  if (videos.length === 0) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  let best: HTMLVideoElement | null = null
  let bestArea = 0

  for (const v of videos) {
    const r = v.getBoundingClientRect()
    const ix = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0))
    const iy = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))
    const area = ix * iy
    if (area > bestArea) {
      bestArea = area
      best = v
    }
  }

  return best
}

/**
 * Extracts the reel ID. Tries the page URL first (most reliable),
 * then walks up from the video looking for a link containing "/reel/".
 */
function extractReelId(video: HTMLVideoElement): string | null {
  // URL-based: /reel/XXXX/ or /reels/XXXX/
  log('extractReelId: pathname =', window.location.pathname)
  const urlMatch = window.location.pathname.match(/\/reels?\/([^/]+)/)
  if (urlMatch) return urlMatch[1]

  // Walk up the DOM and search for a link with /reel/ in href
  let el: Element | null = video
  while (el && el !== document.body) {
    const link = el.querySelector<HTMLAnchorElement>('a[href*="/reel/"]')
    if (link) {
      const m = link.href.match(/\/reel\/([^/]+)/)
      if (m) return m[1]
    }
    el = el.parentElement
  }

  return null
}

/**
 * Finds the creator handle by walking up from the video to the nearest
 * article-like container and looking for a profile link.
 *
 * Profile links look like: href="/username/" (not /reel/, /p/, /explore/, /tags/, /ar/)
 */
function extractCreator(): string {
  const video = getMostVisibleVideo()
  if (!video) return ''

  // Walk up to find a suitable container (article or section)
  let container: Element | null = video
  for (let i = 0; i < 15; i++) {
    if (!container?.parentElement) break
    container = container.parentElement
    if (
      container.tagName === 'ARTICLE' ||
      container.tagName === 'SECTION' ||
      container.getAttribute('role') === 'presentation'
    ) break
  }

  if (!container) return ''

  // Find all anchor tags with hrefs
  const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))
  const SKIP = /\/(reel|p|explore|tags|ar|stories|tv|reels|accounts|about|legal)\//

  for (const a of anchors) {
    const href = a.getAttribute('href') ?? ''
    if (!href.startsWith('/')) continue
    if (SKIP.test(href)) continue
    // Looks like /username/ — extract it
    const m = href.match(/^\/([^/]+)\/?$/)
    if (m && m[1] && m[1] !== '') return `@${m[1]}`
  }

  return ''
}

/**
 * Detects the currently active reel. Returns null if no reel is visible.
 */
function detectActiveReel(): { id: string; creator: string } | null {
  const video = getMostVisibleVideo()
  if (!video) { log('detectActiveReel: no video found'); return null }

  const id = extractReelId(video)
  if (!id) { log('detectActiveReel: no reel ID found, video src =', video.src || video.currentSrc); return null }

  const creator = extractCreator()
  log('detectActiveReel: found reel', id, 'creator:', creator)
  return { id, creator }
}

/**
 * Detects the next reel below the current video's vertical center.
 */
function detectNextReel(): { id: string } | null {
  const current = getMostVisibleVideo()
  if (!current) return null

  const currentCenterY = current.getBoundingClientRect().top + current.offsetHeight / 2
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video[playsinline]'))

  for (const v of videos) {
    if (v === current) continue
    const rect = v.getBoundingClientRect()
    const centerY = rect.top + v.offsetHeight / 2
    if (centerY > currentCenterY) {
      const id = extractReelId(v)
      if (id) return { id }
    }
  }

  return null
}

// ── Main reel change handler ──────────────────────────────────────────────────

function onReelDetected(reel: { id: string; creator: string }) {
  log('onReelDetected:', reel)
  currentReelId = reel.id

  // Ensure overlay exists
  if (!overlay) {
    log('creating ReelCheckOverlay')
    overlay = new ReelCheckOverlay()
  }
  overlay.setProcessing(reel.creator)

  // ── TEMP: fake result for visual testing — DELETE before shipping ──────────
  setTimeout(() => {
    overlay?.setResult({
      reelId: reel.id,
      checkedClaims: [
        {
          claim: { id: 'c1', text: 'Vitamin D cures cancer', type: 'treatment', entities: ['Vitamin D', 'cancer'], timestamp_ms: 2000 },
          verdict: { claimId: 'c1', status: 'contradicted', summary: 'No clinical trials support this. Some research suggests a preventive role, but vitamin D is not an established cancer treatment.', sources: [{ title: 'Vitamin D and Cancer Prevention', url: 'https://www.cancer.gov', excerpt: 'Evidence does not support vitamin D as a cancer cure.', siteName: 'NCI' }] },
        },
        {
          claim: { id: 'c2', text: 'Drinking 8 glasses of water daily is essential', type: 'statistic', entities: ['water'], timestamp_ms: 8000 },
          verdict: { claimId: 'c2', status: 'partially_true', summary: 'Hydration needs vary by person. The "8 glasses" rule is a rough guideline, not a universal requirement.', sources: [{ title: 'Water: How much should you drink every day?', url: 'https://www.mayoclinic.org', excerpt: 'Daily water needs vary based on health, activity, and climate.', siteName: 'Mayo Clinic' }] },
        },
      ],
    })
  }, 2000)
  // ── END TEMP ───────────────────────────────────────────────────────────────

  // Track the active video's position
  const video = getMostVisibleVideo()
  if (video) {
    activeVideo = video
    startPositionTracking(video)
  }

  // Notify background + side panel
  chrome.runtime.sendMessage({ type: 'REEL_CHANGED', reelId: reel.id, creator: reel.creator })

  // Cache hit — show result immediately
  const cached = getCached(reel.id)
  if (cached) {
    overlay.setResult(cached)
    chrome.runtime.sendMessage({ type: 'REEL_CHECKED', result: cached })
    return
  }

  chrome.runtime.sendMessage({ type: 'REEL_PROCESSING', reelId: reel.id })

  // Start audio capture
  chrome.runtime.sendMessage({ type: 'START_AUDIO', reelId: reel.id })

  // Prefetch next reel
  const next = detectNextReel()
  if (next) chrome.runtime.sendMessage({ type: 'START_AUDIO_PREFETCH', reelId: next.id })
}

// ── MutationObserver — watch for reel navigation ──────────────────────────────

const observer = new MutationObserver(() => {
  const reel = detectActiveReel()
  if (!reel || reel.id === currentReelId) return
  onReelDetected(reel)
})

observer.observe(document.body, { childList: true, subtree: true })

// Also handle URL changes (Instagram uses client-side routing)
let lastHref = window.location.href
const hrefObserver = new MutationObserver(() => {
  if (window.location.href !== lastHref) {
    lastHref = window.location.href
    const reel = detectActiveReel()
    if (reel && reel.id !== currentReelId) onReelDetected(reel)
  }
})
hrefObserver.observe(document.body, { childList: true, subtree: true })

// ── Initial detection — run immediately (don't rely on load event for SPA) ───
// document_idle means DOM is ready; check now and also after a short delay
// in case Instagram hasn't rendered the video element yet.
;(function initialDetect() {
  log('initialDetect: running immediately')
  const reel = detectActiveReel()
  if (reel && reel.id !== currentReelId) {
    onReelDetected(reel)
    return
  }
  log('initialDetect: no reel yet, retrying in 1.5s')
  setTimeout(() => {
    log('initialDetect: retry firing')
    const r = detectActiveReel()
    if (r && r.id !== currentReelId) onReelDetected(r)
    else log('initialDetect: retry also found nothing')
  }, 1500)
})()

// ── Video time → overlay + side panel ────────────────────────────────────────

if (videoTimeInterval) clearInterval(videoTimeInterval)
videoTimeInterval = setInterval(() => {
  const video = activeVideo ?? document.querySelector<HTMLVideoElement>('video')
  if (!video) return
  const ms = Math.floor(video.currentTime * 1000)
  overlay?.setTime(ms)
  chrome.runtime.sendMessage({ type: 'VIDEO_TIME', currentMs: ms })
}, 250)

// ── Receive transcript → process + push to overlay ───────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TRANSCRIPT_DONE' && msg.reelId === currentReelId) {
    if (getCached(msg.reelId)) return

    processReel({
      reelId: msg.reelId,
      creator: extractCreator(),
      transcript: msg.transcript as TranscriptSegment[],
    }).then((result) => {
      setCached(msg.reelId, result)
      if (msg.reelId === currentReelId) {
        overlay?.setResult(result)
        chrome.runtime.sendMessage({ type: 'REEL_CHECKED', result })
      }
    }).catch(console.error)
  }

  if (msg.type === 'TRANSCRIPT_DONE' && msg.reelId !== currentReelId) {
    prefetchReel({ id: msg.reelId, creator: '' }, msg.transcript as TranscriptSegment[])
  }
})

