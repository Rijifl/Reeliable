// Haiku: text → structured claims
import { anthropic } from './anthropic.js'
import { CLAIM_EXTRACTOR_SYSTEM, buildClaimExtractorUser } from './prompts.js'
import { Claim } from './types.js'
import crypto from 'crypto'

interface ExtractInput {
  text: string
  source: 'caption' | 'asr'
  creator: string
}

export async function extractClaims(input: ExtractInput): Promise<Claim[]> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: CLAIM_EXTRACTOR_SYSTEM,
    messages: [{ role: 'user', content: buildClaimExtractorUser(input) }],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'

  try {
    const raw: Array<{ claim: string; type: string; entities: string[] }> = JSON.parse(text)
    return raw.map((c) => ({
      id: crypto.randomUUID(),
      text: c.claim,
      type: c.type,
      entities: c.entities,
    }))
  } catch {
    return []
  }
}
