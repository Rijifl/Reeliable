import { ReelCheckOverlay } from './overlay'
import { AnalyzeReelRequest, ChromeMessage } from './types'

// Map from a video element's blob src → reel identity from the MAIN world.
// blob: URLs are unique per video element so they work as a correlation key.
const identityByBlobSrc = new Map<string, { reelId: string; videoUrl: string }>()

// Receive reel identities from the MAIN world fiber-walker script.
window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.data?.source !== 'REELCHECK_MAIN' || event.data?.type !== 'REEL_IDENTITY') return

  const { shortcode, videoUrl, blobSrc } = event.data as {
    shortcode: string; videoUrl: string; blobSrc: string
  }

  if (blobSrc) identityByBlobSrc.set(blobSrc, { reelId: shortcode, videoUrl })

  // Prefetch any reel that isn't already the active one
  if (currentReel?.reelId !== shortcode) {
    chrome.runtime.sendMessage({
      type: 'REEL_PREFETCH',
      request: { reelId: shortcode, creator: '', videoUrl },
    }).catch(() => {})
  }
})

const log = (...args: unknown[]) => console.log('[ReelCheck]', ...args)

let enabled = true
let overlay: ReelCheckOverlay | null = null
let activeVideo: HTMLVideoElement | null = null
let currentReel: { reelId: string; videoUrl: string } | null = null
let positionCleanup: (() => void) | null = null

chrome.storage.local.get('enabled', ({ enabled: stored }) => {
  enabled = stored ?? true
})

function getMostVisibleVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'))
  if (videos.length === 0) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  let best: HTMLVideoElement | null = null
  let bestArea = 0

  for (const video of videos) {
    const rect = video.getBoundingClientRect()
    const ix = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0))
    const iy = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0))
    const area = ix * iy
    if (area > bestArea) {
      bestArea = area
      best = video
    }
  }

  return best
}

// Instagram uses MSE — video.currentSrc is always a blob: URL.
// We use the canonical reel URL instead; the server downloads it via yt-dlp.
function extractVideoUrl(reelId: string): string {
  return `https://www.instagram.com/reels/${reelId}/`
}

// Valid Instagram shortcode: base64url chars, 6-20 length
const SHORTCODE_RE = /^[A-Za-z0-9_-]{6,20}$/

function extractReelId(video: HTMLVideoElement): string | null {
  // Match /reel/, /reels/, /p/ followed by a valid shortcode
  const fromPath = window.location.pathname.match(/\/(?:reels?|p)\/([A-Za-z0-9_-]{6,20})\/?/)
  if (fromPath?.[1] && SHORTCODE_RE.test(fromPath[1])) return fromPath[1]

  // Walk up DOM looking for reel/post links
  let node: Element | null = video
  while (node && node !== document.body) {
    const anchor = node.querySelector<HTMLAnchorElement>('a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"]')
    if (anchor) {
      const m = anchor.href.match(/\/(?:reels?|p)\/([A-Za-z0-9_-]{6,20})\//)
      if (m?.[1] && SHORTCODE_RE.test(m[1])) return m[1]
    }
    node = node.parentElement
  }

  return null
}

function extractCreator(video: HTMLVideoElement): string {
  let container: Element | null = video
  for (let i = 0; i < 12; i++) {
    if (!container?.parentElement) break
    container = container.parentElement
    if (container.tagName === 'ARTICLE' || container.tagName === 'SECTION') break
  }

  if (!container) return ''

  const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))
  const skip = /\/(reel|reels|p|explore|tags|accounts|stories|about|legal)\//

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href') ?? ''
    if (!href.startsWith('/')) continue
    if (skip.test(href)) continue
    const m = href.match(/^\/([^/]+)\/?$/)
    if (m?.[1]) return `@${m[1]}`
  }

  return ''
}

function buildAnalyzeRequest(video: HTMLVideoElement): AnalyzeReelRequest | null {
  // Primary: URL/DOM-based extraction
  let reelId = extractReelId(video)

  // Fallback: fiber-walker identity received from MAIN world, matched by blob src
  if (!reelId && video.currentSrc) {
    const identity = identityByBlobSrc.get(video.currentSrc)
    if (identity) reelId = identity.reelId
  }

  if (!reelId) return null
  const videoUrl = extractVideoUrl(reelId)

  const durationMs = Number.isFinite(video.duration) ? Math.max(0, Math.round(video.duration * 1000)) : undefined
  return {
    reelId,
    creator: extractCreator(video),
    videoUrl,
    durationMs,
  }
}

// Extract post images from the article DOM — CDN URLs are directly fetchable.
// Filters out profile pictures (small avatars) by requiring naturalWidth > 200.
function extractPostImageUrls(): string[] {
  const article = document.querySelector<HTMLElement>('article')
  if (!article) return []
  return Array.from(article.querySelectorAll<HTMLImageElement>('img[src]'))
    .filter(img => {
      const src = img.src
      if (!src || src.startsWith('blob:')) return false
      if (!(src.includes('cdninstagram.com') || src.includes('fbcdn.net'))) return false
      // Skip small avatars/icons
      const w = img.naturalWidth || img.width
      return w > 200
    })
    .map(img => img.src)
    .filter((src, i, arr) => arr.indexOf(src) === i) // dedupe
    .slice(0, 10)
}

// Extract the post caption from the h1 element Instagram uses.
function extractPostCaption(): string {
  const h1 = document.querySelector<HTMLElement>('article h1, h1._ap3a')
  return h1?.textContent?.trim() ?? ''
}

// Detect image posts from the URL — no video element needed.
// Handles /p/{shortcode}/ carousel and single-image posts.
function buildAnalyzeRequestFromUrl(): AnalyzeReelRequest | null {
  const m = window.location.pathname.match(/\/p\/([A-Za-z0-9_-]{6,20})\//)
  if (!m?.[1]) return null
  const reelId = m[1]
  const imageUrls = extractPostImageUrls()
  const caption = extractPostCaption()
  return {
    reelId,
    creator: '',
    videoUrl: `https://www.instagram.com/p/${reelId}/`,
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    caption: caption || undefined,
  }
}

// Find the main post article to anchor the overlay on image posts.
function getPostArticleRect(): DOMRect | null {
  const article = document.querySelector<HTMLElement>('article[role="presentation"], article')
  return article ? article.getBoundingClientRect() : null
}

function startPositionTracking(video: HTMLVideoElement) {
  stopPositionTracking()

  const update = () => {
    if (overlay && video.isConnected) {
      overlay.updatePosition(video.getBoundingClientRect())
    }
  }

  update()

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

function ensureOverlay() {
  if (!overlay) overlay = new ReelCheckOverlay()
  return overlay
}

function hideOverlay() {
  if (currentReel) {
    chrome.runtime.sendMessage({ type: 'REEL_CHANGED', reelId: currentReel.reelId }).catch(() => {})
  }
  currentReel = null
  activeVideo = null
  stopPositionTracking()
  overlay?.setIdle()
}

function scanForActiveReel() {
  if (!enabled) return

  const video = getMostVisibleVideo()

  // Try video-based detection first, then fall back to image post URL detection
  const request = (video ? buildAnalyzeRequest(video) : null) ?? buildAnalyzeRequestFromUrl()

  if (!request) {
    if (currentReel) hideOverlay()
    return
  }

  const isSameReel =
    currentReel?.reelId === request.reelId &&
    currentReel.videoUrl === request.videoUrl

  if (isSameReel) return

  if (currentReel && currentReel.reelId !== request.reelId) {
    chrome.runtime.sendMessage({ type: 'REEL_CHANGED', reelId: currentReel.reelId }).catch(() => {})
  }

  currentReel = { reelId: request.reelId, videoUrl: request.videoUrl }
  activeVideo = video ?? null

  if (video) {
    startPositionTracking(video)
  } else {
    // Image post: anchor overlay to the article element
    stopPositionTracking()
    const rect = getPostArticleRect()
    if (rect) ensureOverlay().updatePosition(rect)
  }

  const ui = ensureOverlay()
  ui.setProcessing(request.creator)

  chrome.runtime.sendMessage({ type: 'REEL_DETECTED', request }).catch(() => {})
  log('REEL_DETECTED', request.reelId, request.videoUrl)
}

const observer = new MutationObserver(scanForActiveReel)
observer.observe(document.body, { childList: true, subtree: true })

let lastHref = window.location.href
const hrefObserver = new MutationObserver(() => {
  if (window.location.href !== lastHref) {
    lastHref = window.location.href
    // Hide immediately on navigation; scanForActiveReel will re-show if a reel is found
    if (currentReel) hideOverlay()
    setTimeout(scanForActiveReel, 400)
  }
})
hrefObserver.observe(document.body, { childList: true, subtree: true })

scanForActiveReel()
setTimeout(scanForActiveReel, 1200)
setInterval(scanForActiveReel, 1500)

setInterval(() => {
  if (!enabled) return
  const video = activeVideo && activeVideo.isConnected ? activeVideo : getMostVisibleVideo()
  if (!video) return

  const currentMs = Math.max(0, Math.floor(video.currentTime * 1000))
  overlay?.setTime(currentMs)
  chrome.runtime.sendMessage({ type: 'VIDEO_TIME', currentMs })
}, 250)

chrome.runtime.onMessage.addListener((message: ChromeMessage) => {
  if (message.type === 'SET_ENABLED') {
    enabled = message.enabled
    if (!enabled) {
      if (currentReel) chrome.runtime.sendMessage({ type: 'REEL_CHANGED', reelId: currentReel.reelId })
      currentReel = null
      activeVideo = null
      stopPositionTracking()
      overlay?.destroy()
      overlay = null
      return
    }
    scanForActiveReel()
    return
  }

  if (!currentReel) return

  if (message.type === 'ANALYSIS_STARTED' && message.reelId === currentReel.reelId) {
    ensureOverlay().setProcessing(message.creator)
  }

  if (message.type === 'ANALYSIS_COMPLETE' && message.reelId === currentReel.reelId) {
    ensureOverlay().setResult(message.result)
  }

  if (message.type === 'ANALYSIS_ERROR' && message.reelId === currentReel.reelId) {
    ensureOverlay().setError(message.message)
  }
})

