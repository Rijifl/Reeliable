import { CheckRequest, SSEEvent } from './types'

const SERVER_URL = 'http://localhost:3001'

// SSE client — POST /v1/check and stream verdict events back
export function connectSSE(req: CheckRequest, onEvent?: (e: SSEEvent) => void) {
  fetch(`${SERVER_URL}/v1/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  }).then(async (res) => {
    if (!res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event: SSEEvent = JSON.parse(line.slice(6))
          onEvent?.(event)
          // Dispatch to overlay via custom DOM event
          window.dispatchEvent(new CustomEvent('reelcheck:event', { detail: event }))
        } catch {
          // malformed SSE line — skip
        }
      }
    }
  }).catch(console.error)
}
