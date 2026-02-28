import { TranscriptSegment } from './types'
import { processReel } from './api'
import { prefetchReel, getCached, setCached } from './prefetch'

let currentReelId: string | null = null
let videoTimeInterval: ReturnType<typeof setInterval> | null = null

// Watch for reel changes
const observer = new MutationObserver(() => {
  const reel = detectActiveReel()
  if (!reel || reel.id === currentReelId) return

  currentReelId = reel.id

  // Tell the side panel a new reel is active
  chrome.runtime.sendMessage({
    type: 'REEL_CHANGED',
    reelId: reel.id,
    creator: reel.creator,
  })

  // If already prefetched, send results to panel immediately
  const cached = getCached(reel.id)
  if (cached) {
    chrome.runtime.sendMessage({ type: 'REEL_CHECKED', result: cached })
  } else {
    chrome.runtime.sendMessage({ type: 'REEL_PROCESSING', reelId: reel.id })
  }

  // Start audio capture
  chrome.runtime.sendMessage({ type: 'START_AUDIO', reelId: reel.id })

  // Prefetch the next reel
  const next = detectNextReel()
  if (next) {
    chrome.runtime.sendMessage({ type: 'START_AUDIO_PREFETCH', reelId: next.id })
  }

  // Relay video playback time to side panel for timestamp-synced cards
  if (videoTimeInterval) clearInterval(videoTimeInterval)
  videoTimeInterval = setInterval(() => {
    const video = document.querySelector('video')
    if (video) {
      chrome.runtime.sendMessage({
        type: 'VIDEO_TIME',
        currentMs: Math.floor(video.currentTime * 1000),
      })
    }
  }, 250)
})

observer.observe(document.body, { childList: true, subtree: true })

// Receive full transcript from offscreen → process + send to panel
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TRANSCRIPT_DONE' && msg.reelId === currentReelId) {
    if (getCached(msg.reelId)) return

    processReel({
      reelId: msg.reelId,
      creator: extractCreator(),
      transcript: msg.transcript,
    }).then((result) => {
      setCached(msg.reelId, result)
      if (msg.reelId === currentReelId) {
        chrome.runtime.sendMessage({ type: 'REEL_CHECKED', result })
      }
    }).catch(console.error)
  }

  if (msg.type === 'TRANSCRIPT_DONE' && msg.reelId !== currentReelId) {
    prefetchReel({ id: msg.reelId, creator: '' }, msg.transcript as TranscriptSegment[])
  }
})

function detectActiveReel(): { id: string; creator: string } | null {
  // TODO: implement for Instagram's reel DOM structure
  return null
}

function detectNextReel(): { id: string } | null {
  // TODO: find the next preloaded reel below the current one
  return null
}

function extractCreator(): string {
  // TODO: extract creator handle from current reel
  return ''
}
