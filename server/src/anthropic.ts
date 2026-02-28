import Anthropic from '@anthropic-ai/sdk'

// Lazy — read env at call time, not at module init (before dotenv runs in ESM)
let _client: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}
