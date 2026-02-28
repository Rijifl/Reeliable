// Offscreen document — runs MediaRecorder + Deepgram WebSocket
// Audio flow: chrome.tabCapture → MediaRecorder → Deepgram → relay transcripts

import { AudioCapture } from './audio-capture'
import { DeepgramClient } from './deepgram'

const audioCapture = new AudioCapture()
const deepgram = new DeepgramClient()
let currentReelId: string | null = null

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'OFFSCREEN_START') {
    currentReelId = msg.reelId
    startCapture(msg.reelId)
  }
  if (msg.type === 'OFFSCREEN_STOP') {
    stopCapture()
  }
})

async function startCapture(reelId: string) {
  stopCapture()

  // Get tab audio stream
  const stream = await (chrome.tabCapture as any).capture({ audio: true, video: false })
  if (!stream) return

  const apiKey = await getDeepgramKey()

  deepgram.connect({
    apiKey,
    onTranscript: (text) => {
      // Relay final transcript to background → content script
      chrome.runtime.sendMessage({ type: 'ASR_TRANSCRIPT', reelId, transcript: text })
    },
  })

  audioCapture.start(stream, {
    chunkIntervalMs: 250,
    onChunk: (chunk) => deepgram.send(chunk),
  })
}

function stopCapture() {
  audioCapture.stop()
  deepgram.disconnect()
  currentReelId = null
}

async function getDeepgramKey(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get('deepgramKey', ({ deepgramKey }) => resolve(deepgramKey ?? ''))
  })
}
