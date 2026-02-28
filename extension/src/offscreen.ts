// Offscreen document — tab audio capture + Deepgram → full timestamped transcript
import { AudioCapture } from './audio-capture'
import { DeepgramClient } from './deepgram'
import { TranscriptSegment } from './types'

interface ActiveCapture {
  audio: AudioCapture
  deepgram: DeepgramClient
  segments: TranscriptSegment[]
}

const captures = new Map<string, ActiveCapture>()

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'OFFSCREEN_START') startCapture(msg.reelId)
  if (msg.type === 'OFFSCREEN_STOP') stopCapture(msg.reelId)
})

async function startCapture(reelId: string) {
  if (captures.has(reelId)) return

  const stream = await (chrome.tabCapture as any).capture({ audio: true, video: false })
  if (!stream) return

  const apiKey = await getDeepgramKey()
  const segments: TranscriptSegment[] = []

  const deepgram = new DeepgramClient()
  const audio = new AudioCapture()

  captures.set(reelId, { audio, deepgram, segments })

  deepgram.connect({
    apiKey,
    onSegment: (seg) => {
      segments.push(seg)
      // Relay each segment back so overlay can show partial progress
      chrome.runtime.sendMessage({ type: 'ASR_SEGMENT', reelId, segment: seg })
    },
    onDone: (allSegments) => {
      // Full transcript complete — send to content script for processing
      chrome.runtime.sendMessage({ type: 'TRANSCRIPT_DONE', reelId, transcript: allSegments })
      captures.delete(reelId)
    },
  })

  audio.start(stream, {
    chunkIntervalMs: 250,
    onChunk: (chunk) => deepgram.send(chunk),
  })
}

function stopCapture(reelId: string) {
  const capture = captures.get(reelId)
  if (!capture) return
  capture.deepgram.finish() // sends CloseStream → triggers onDone with full transcript
  capture.audio.stop()
  captures.delete(reelId)
}

async function getDeepgramKey(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get('deepgramKey', ({ deepgramKey }) => resolve(deepgramKey ?? ''))
  })
}
