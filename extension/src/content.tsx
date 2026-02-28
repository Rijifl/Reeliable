import { ReelCheckOverlay } from './overlay'
import { AnalyzeReelRequest, ChromeMessage } from './types'

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

function extractVideoUrl(video: HTMLVideoElement): string | null {
  const source = video.querySelector<HTMLSourceElement>('source[src]')
  const sourceUrl = source?.src?.trim()

  const fromCurrentSrc = video.currentSrc?.trim()
  if (fromCurrentSrc && !fromCurrentSrc.startsWith('blob:')) return fromCurrentSrc

  const fromSrc = video.src?.trim()
  if (fromSrc && !fromSrc.startsWith('blob:')) return fromSrc

  return sourceUrl || fromCurrentSrc || fromSrc || null
}

function extractReelId(video: HTMLVideoElement): string | null {
  const fromPath = window.location.pathname.match(/\/reels?\/([^/?#]+)/i)
  if (fromPath?.[1]) return fromPath[1]

  let node: Element | null = video
  while (node && node !== document.body) {
    const anchor = node.querySelector<HTMLAnchorElement>('a[href*="/reel/"], a[href*="/reels/"]')
    if (anchor) {
      const m = anchor.href.match(/\/reels?\/([^/?#]+)/i)
      if (m?.[1]) return m[1]
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
  const reelId = extractReelId(video)
  const videoUrl = extractVideoUrl(video)
  if (!reelId || !videoUrl) return null

  const durationMs = Number.isFinite(video.duration) ? Math.max(0, Math.round(video.duration * 1000)) : undefined
  return {
    reelId,
    creator: extractCreator(video),
    videoUrl,
    durationMs,
  }
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

function scanForActiveReel() {
  if (!enabled) return

  const video = getMostVisibleVideo()
  if (!video) return

  const request = buildAnalyzeRequest(video)
  if (!request) return

  const isSameReel =
    currentReel?.reelId === request.reelId &&
    currentReel.videoUrl === request.videoUrl

  if (isSameReel) return

  if (currentReel && currentReel.reelId !== request.reelId) {
    chrome.runtime.sendMessage({ type: 'REEL_CHANGED', reelId: currentReel.reelId })
  }

  currentReel = { reelId: request.reelId, videoUrl: request.videoUrl }
  activeVideo = video
  startPositionTracking(video)

  const ui = ensureOverlay()
  ui.setProcessing(request.creator)

  chrome.runtime.sendMessage({ type: 'REEL_DETECTED', request })
  log('REEL_DETECTED', request.reelId, request.videoUrl)
}

const observer = new MutationObserver(scanForActiveReel)
observer.observe(document.body, { childList: true, subtree: true })

let lastHref = window.location.href
const hrefObserver = new MutationObserver(() => {
  if (window.location.href !== lastHref) {
    lastHref = window.location.href
    scanForActiveReel()
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

