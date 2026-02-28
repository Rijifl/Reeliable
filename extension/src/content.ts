import { CheckRequest } from './types'
import { connectSSE } from './api'

let lastReelId: string | null = null

// DOM Observer — watches for reel container changes in Instagram's DOM
const observer = new MutationObserver(() => {
  const reel = detectActiveReel()
  if (reel && reel.id !== lastReelId) {
    lastReelId = reel.id

    // 1. Extract caption text immediately (0ms)
    const captionText = extractReelText(reel.container)

    // 2. Start audio capture via background → offscreen
    chrome.runtime.sendMessage({ type: 'START_AUDIO', reelId: reel.id })

    // 3. Send caption text to backend
    if (captionText) {
      const req: CheckRequest = {
        reelId: reel.id,
        text: captionText,
        source: 'caption',
        creator: extractCreator(reel.container),
      }
      connectSSE(req)
    }
  }
})

observer.observe(document.body, { childList: true, subtree: true })

// Listen for ASR transcripts relayed from offscreen via background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'ASR_TRANSCRIPT' && lastReelId) {
    const req: CheckRequest = {
      reelId: lastReelId,
      text: msg.transcript,
      source: 'asr',
      creator: '',
    }
    connectSSE(req)
  }
})

function detectActiveReel(): { id: string; container: Element } | null {
  // TODO: implement reel detection for Instagram's DOM structure
  return null
}

function extractReelText(container: Element): string {
  // TODO: extract caption + hashtags from reel container
  return container.querySelector('[data-testid="reel-caption"]')?.textContent ?? ''
}

function extractCreator(container: Element): string {
  // TODO: extract creator handle from reel container
  return container.querySelector('a[href*="/"]')?.textContent ?? ''
}
