import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { AnalyzeReelResponse, Discrepancy, ExtractedClaim, TranscriptEntry } from './types.js'
import { ExtractedFrame } from './video-processor.js'
import { VLM_SYSTEM_PROMPT, buildVlmUserPrompt } from './vlm-prompts.js'
import { getAnthropic } from './anthropic.js'

type AnalysisBody = Omit<AnalyzeReelResponse, 'reelId'>

export async function analyzeVideo(frames: ExtractedFrame[], creator: string, caption?: string): Promise<AnalysisBody> {
  const content: Anthropic.MessageParam['content'] = []

  if (caption) {
    content.push({ type: 'text', text: `Post caption: ${caption}` })
  }

  for (const frame of frames) {
    content.push({ type: 'text', text: `[Frame at ${formatMs(frame.timestampMs)}]` })
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: frame.base64 },
    })
  }
  content.push({ type: 'text', text: buildVlmUserPrompt(creator) })

  const response = await getAnthropic().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: VLM_SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const raw = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

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
