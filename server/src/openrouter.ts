import crypto from 'crypto'
import { AnalyzeReelResponse, Discrepancy, ExtractedClaim, TranscriptEntry } from './types.js'
import { ExtractedFrame } from './video-processor.js'
import { VLM_SYSTEM_PROMPT, buildVlmUserPrompt } from './vlm-prompts.js'

type AnalysisBody = Omit<AnalyzeReelResponse, 'reelId'>

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_VLM_MODEL = process.env.OPENROUTER_VLM_MODEL?.trim() || 'qwen/qwen3-vl-8b-thinking'

type OpenRouterContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

type OpenRouterMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: OpenRouterContentPart[] }

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
  error?: { message?: string }
}

export async function analyzeVideo(frames: ExtractedFrame[], creator: string): Promise<AnalysisBody> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required')
  }

  const content: OpenRouterContentPart[] = []

  for (const frame of frames) {
    content.push({ type: 'text', text: `[Frame at ${formatMs(frame.timestampMs)}]` })
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${frame.base64}` },
    })
  }
  content.push({ type: 'text', text: buildVlmUserPrompt(creator) })

  const messages: OpenRouterMessage[] = [
    { role: 'system', content: VLM_SYSTEM_PROMPT },
    { role: 'user', content },
  ]

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://localhost',
      'X-Title': 'ReelCheck VLM',
    },
    body: JSON.stringify({
      model: DEFAULT_VLM_MODEL,
      max_tokens: 4096,
      temperature: 0.1,
      messages,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter request failed (${response.status}): ${errorText.slice(0, 400)}`)
  }

  const payload = (await response.json()) as OpenRouterResponse
  if (payload.error?.message) {
    throw new Error(`OpenRouter error: ${payload.error.message}`)
  }

  const raw = extractOpenRouterText(payload)
  if (!raw.trim()) {
    throw new Error('OpenRouter returned an empty response')
  }

  console.log('\n── VLM raw response ──')
  console.log(raw.slice(0, 1000))
  console.log('──────────────────────\n')

  const cleaned = stripMarkdownCodeFence(raw)
  const parsed = parseJsonObject(cleaned)
  return sanitizeAnalysisBody(parsed)
}

function sanitizeAnalysisBody(input: unknown): AnalysisBody {
  const data = asRecord(input)
  const transcript = sanitizeTranscript(data.transcript)
  const claims = sanitizeClaims(data.claims)
  const discrepancies = sanitizeDiscrepancies(data.discrepancies)
  return { transcript, claims, discrepancies }
}

function sanitizeTranscript(value: unknown): TranscriptEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const r = asRecord(item)
      const text = String(r.text ?? '').trim()
      const timestampMs = toNonNegativeNumber(r.timestampMs)
      if (!text) return null
      return { text, timestampMs }
    })
    .filter((item): item is TranscriptEntry => item !== null)
}

function sanitizeClaims(value: unknown): ExtractedClaim[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const r = asRecord(item)
      const text = String(r.text ?? '').trim()
      if (!text) return null
      const id = String(r.id ?? crypto.randomUUID())
      const reasoning = String(r.reasoning ?? '').trim()
      const authorSources = Array.isArray(r.authorSources)
        ? r.authorSources.map((s) => String(s))
        : []
      const timestampMs = toNonNegativeNumber(r.timestampMs)
      return { id, text, reasoning, authorSources, timestampMs }
    })
    .filter((item): item is ExtractedClaim => item !== null)
    .slice(0, 3)
}

function sanitizeDiscrepancies(value: unknown): Discrepancy[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const r = asRecord(item)
      const description = String(r.description ?? '').trim()
      if (!description) return null
      const severity = toSeverity(r.severity)
      const frameTimestampMs = toNonNegativeNumber(r.frameTimestampMs)
      return { description, severity, frameTimestampMs }
    })
    .filter((item): item is Discrepancy => item !== null)
}

function toSeverity(value: unknown): Discrepancy['severity'] {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return 'medium'
}

function toNonNegativeNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function stripMarkdownCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
}

function parseJsonObject(text: string): unknown {
  const direct = tryParseJson(text)
  if (direct !== null) return direct

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const sliced = text.slice(start, end + 1)
    const parsed = tryParseJson(sliced)
    if (parsed !== null) return parsed
  }

  throw new Error('VLM response did not contain valid JSON')
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

function extractOpenRouterText(payload: OpenRouterResponse): string {
  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim()
  }
  throw new Error('OpenRouter response did not contain text content')
}
