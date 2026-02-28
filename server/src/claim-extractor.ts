// Haiku: full transcript with timestamps → list of claims with timestamps
import { getAnthropic } from './anthropic.js'
import { CLAIM_EXTRACTOR_SYSTEM, MAX_CLAIMS, buildClaimExtractorUser } from './prompts.js'
import { Claim, TranscriptSegment } from './types.js'
import crypto from 'crypto'

export async function extractClaims(
  transcript: TranscriptSegment[],
  creator: string
): Promise<Claim[]> {
  // Combine transcript into a single string with timestamps for context
  const fullText = transcript
    .map((s) => `[${formatMs(s.start_ms)}] ${s.text}`)
    .join('\n')

  const msg = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: CLAIM_EXTRACTOR_SYSTEM,
    messages: [{ role: 'user', content: buildClaimExtractorUser(fullText, creator) }],
  })

  const raw_text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  const text = raw_text.replace(/```json|```/g, '').trim()

  console.log('\n── Haiku claim extraction ──────────────────')
  console.log(raw_text)
  console.log('────────────────────────────────────────────\n')

  try {
    const raw: Array<{
      claim: string
      type: string
      entities: string[]
      timestamp_ms: number
    }> = JSON.parse(text)

    return raw.slice(0, MAX_CLAIMS).map((c) => ({
      id: crypto.randomUUID(),
      text: c.claim,
      type: c.type,
      entities: c.entities,
      timestamp_ms: c.timestamp_ms,
    }))
  } catch {
    return []
  }
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
