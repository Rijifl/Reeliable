import crypto from 'crypto'
import { AnalyzeReelResponse, Discrepancy, ExtractedClaim, TranscriptEntry } from './types.js'
import { ExtractedFrame } from './video-processor.js'
import { VLM_SYSTEM_PROMPT, buildVlmUserPrompt } from './vlm-prompts.js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
// Verified model id on OpenRouter model page.
const MODEL = 'qwen/qwen3-vl-8b-instruct'

type AnalysisBody = Omit<AnalyzeReelResponse, 'reelId'>

export async function analyzeVideo(frames: ExtractedFrame[], creator: string): Promise<AnalysisBody> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set')
  }

  const content: Array<Record<string, unknown>> = []
  for (const frame of frames) {
    content.push({ type: 'text', text: `[Frame at ${formatMs(frame.timestampMs)}]` })
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${frame.base64}` },
    })
  }
  content.push({ type: 'text', text: buildVlmUserPrompt(creator) })

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: VLM_SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenRouter request failed (${res.status}): ${text}`)
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = payload.choices?.[0]?.message?.content ?? ''
  const cleaned = stripThinkTags(stripMarkdownCodeFence(raw))
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

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
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
