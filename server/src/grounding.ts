// Web-search grounding: fact-check each extracted claim against real sources using
// Gemini's built-in Google Search grounding. This is a Gemini-native call (the
// OpenAI-compatible endpoint used by vlm.ts does not expose grounding), so it runs
// only when a Gemini key is available — otherwise claims are returned un-graded.
import { ExtractedClaim, Verdict, VerdictSource } from './types.js'
import { sleep } from './vlm.js'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GROUNDING_MODEL = process.env.GROUNDING_MODEL ?? 'gemini-2.5-flash'
const MAX_SOURCES = 4

function groundingApiKey(): string {
  if (process.env.GROUNDING_API_KEY) return process.env.GROUNDING_API_KEY
  // Reuse the VLM key only when the VLM itself is Gemini (same provider + key).
  const base = process.env.VLM_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai'
  if (base.includes('generativelanguage.googleapis.com')) return process.env.VLM_API_KEY ?? ''
  return ''
}

export function groundingEnabled(): boolean {
  return groundingApiKey().length > 0
}

/** Fact-check each claim in place (sets `claim.verdict`). Failures are swallowed
 *  per-claim so one bad lookup never fails the whole analysis. */
export async function groundClaims(claims: ExtractedClaim[]): Promise<void> {
  if (!groundingEnabled() || claims.length === 0) return
  await Promise.all(
    claims.map(async (claim) => {
      try {
        claim.verdict = await groundClaim(claim.text)
      } catch (err) {
        console.warn(`   grounding failed for "${claim.text.slice(0, 60)}":`, String(err))
      }
    }),
  )
}

async function groundClaim(claimText: string): Promise<Verdict | undefined> {
  const key = groundingApiKey()
  if (!key) return undefined

  const prompt = `You are a careful health/medical fact-checker. Using Google Search, verify this claim taken from a social-media video:

"${claimText}"

Judge it only against reputable sources (peer-reviewed studies, health agencies like WHO/CDC/NHS, systematic reviews). Then respond with ONLY a JSON object, no markdown:
{"status":"supported|contradicted|partially_true|unverified","summary":"1-2 plain-language sentences explaining the verdict"}
Use "unverified" if reputable sources do not clearly address the claim.`

  const url = `${GEMINI_BASE}/models/${GROUNDING_MODEL}:generateContent?key=${encodeURIComponent(key)}`
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
  })

  let res: Response | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
    if (res.ok) break
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep(800 * 2 ** attempt)
      continue
    }
    break
  }
  if (!res || !res.ok) {
    const detail = res ? await res.text().catch(() => '') : 'no response'
    throw new Error(`grounding request failed: ${res?.status ?? 0} ${detail.slice(0, 200)}`)
  }

  const data = (await res.json()) as GeminiResponse
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  const parsed = parseVerdict(text)
  if (!parsed) return undefined

  return {
    status: parsed.status,
    summary: parsed.summary,
    sources: extractSources(candidate?.groundingMetadata),
  }
}

interface GroundingMetadata {
  groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
}
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    groundingMetadata?: GroundingMetadata
  }>
}

function parseVerdict(text: string): { status: Verdict['status']; summary: string } | undefined {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as { status?: unknown; summary?: unknown }
    const summary = String(obj.summary ?? '').trim()
    if (!summary) return undefined
    return { status: toStatus(obj.status), summary }
  } catch {
    return undefined
  }
}

function toStatus(v: unknown): Verdict['status'] {
  if (v === 'supported' || v === 'contradicted' || v === 'partially_true' || v === 'unverified') return v
  return 'unverified'
}

function extractSources(meta: GroundingMetadata | undefined): VerdictSource[] {
  const sources: VerdictSource[] = []
  const seen = new Set<string>()
  for (const ch of meta?.groundingChunks ?? []) {
    const url = ch.web?.uri
    if (!url || seen.has(url)) continue
    seen.add(url)
    sources.push({ title: String(ch.web?.title ?? url), url })
    if (sources.length >= MAX_SOURCES) break
  }
  return sources
}
