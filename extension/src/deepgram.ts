// Deepgram WebSocket streaming ASR client

const DEEPGRAM_URL = 'wss://api.deepgram.com/v1/listen?model=nova-2-medical&punctuate=true'

export interface DeepgramOptions {
  apiKey: string
  onTranscript: (text: string) => void
}

export class DeepgramClient {
  private ws: WebSocket | null = null

  connect(opts: DeepgramOptions) {
    this.ws = new WebSocket(DEEPGRAM_URL, ['token', opts.apiKey])

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const alt = data?.channel?.alternatives?.[0]
        if (alt?.is_final && alt.transcript) {
          opts.onTranscript(alt.transcript)
        }
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onerror = (e) => console.error('[deepgram] error', e)
  }

  send(chunk: Blob) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk)
    }
  }

  disconnect() {
    this.ws?.close()
    this.ws = null
  }
}
