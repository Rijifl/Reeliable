// Deepgram WebSocket — accumulates a full timestamped transcript for a reel
import { TranscriptSegment } from './types'

const DEEPGRAM_URL = 'wss://api.deepgram.com/v1/listen?model=nova-2-medical&punctuate=true&utterances=true'

export interface DeepgramOptions {
  apiKey: string
  onSegment: (segment: TranscriptSegment) => void
  onDone: (segments: TranscriptSegment[]) => void
}

export class DeepgramClient {
  private ws: WebSocket | null = null
  private segments: TranscriptSegment[] = []
  private startTime: number = 0

  connect(opts: DeepgramOptions) {
    this.segments = []
    this.startTime = Date.now()
    this.ws = new WebSocket(DEEPGRAM_URL, ['token', opts.apiKey])

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const alt = data?.channel?.alternatives?.[0]

        // Only use final (non-partial) results
        if (!data.is_final || !alt?.transcript) return

        const segment: TranscriptSegment = {
          text: alt.transcript,
          start_ms: Math.round((data.start ?? 0) * 1000),
          end_ms: Math.round(((data.start ?? 0) + (data.duration ?? 0)) * 1000),
        }

        this.segments.push(segment)
        opts.onSegment(segment)
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onerror = (e) => console.error('[deepgram] error', e)

    this.ws.onclose = () => {
      opts.onDone([...this.segments])
    }
  }

  send(chunk: Blob) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk)
    }
  }

  // Call when the reel ends — closes WebSocket, triggers onDone
  finish() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Send CloseStream message then close
      this.ws.send(JSON.stringify({ type: 'CloseStream' }))
    }
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
    this.segments = []
  }
}
