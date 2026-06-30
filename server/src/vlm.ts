import crypto from 'crypto'
import { AnalyzeReelResponse, Discrepancy, ExtractedClaim, TranscriptEntry } from './types.js'
import { ExtractedFrame } from './video-processor.js'
import { VLM_SYSTEM_PROMPT, buildVlmUserPrompt } from './vlm-prompts.js'

type AnalysisBody = Omit<AnalyzeReelResponse, 'reelId'>

// --- Provider config (any OpenAI-compatible /chat/completions vision endpoint) ---
// Defaults target Google Gemini Flash's free tier. Swap providers with env vars:
//   OpenRouter:   VLM_BASE_URL=https://openrouter.ai/api/v1     VLM_MODEL=qwen/qwen-2.5-vl-72b-instruct:free
//   Groq:         VLM_BASE_URL=https://api.groq.com/openai/v1   VLM_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct
//   Local/Ollama: VLM_BASE_URL=http://localhost:11434/v1        VLM_MODEL=qwen2.5vl   VLM_API_KEY=ollama
const VLM_BASE_URL = (process.env.VLM_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/+$/, '')
const VLM_MODEL = process.env.VLM_MODEL ?? 'gemini-2.5-flash'
const VLM_API_KEY = process.env.VLM_API_KEY ?? ''

// Caps so a long or adversarial reel can't return an unbounded payload / overlay.
const MAX_TRANSCRIPT = 60
const MAX_CLAIMS = 3
const MAX_DISCREPANCIES = 10

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

interface ChatMessage {
  role: 'system' | 'user'
  content: string | ContentPart[]
}

export async function analyzeVideo(
  frames: ExtractedFrame[],
  creator: string,
  caption?: string,
  whisperTranscript?: string,
): Promise<AnalysisBody> {
  const content: ContentPart[] = []

  if (whisperTranscript) {
    content.push({ type: 'text', text: `Audio transcript (from Whisper):\n${whisperTranscript}` })
  }
  if (caption) {
    content.push({ type: 'text', text: `Post caption: ${caption}` })
  }
  for (const frame of frames) {
    content.push({ type: 'text', text: `[Frame at ${formatMs(frame.timestampMs)}]` })
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${frame.base64}` },
    })
  }
  content.push({ type: 'text', text: buildVlmUserPrompt(creator) })

  const raw = await callVlm([
    { role: 'system', content: VLM_SYSTEM_PROMPT },
    { role: 'user', content },
  ])

  const parsed = parseJsonObject(stripMarkdownCodeFence(raw))
  return sanitizeAnalysisBody(parsed)
}

const MAX_VLM_RETRIES = 3

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callVlm(messages: ChatMessage[]): Promise<string> {
  const isLocal = /localhost|127\.0\.0\.1/.test(VLM_BASE_URL)
  if (!VLM_API_KEY && !isLocal) {
    throw new Error('VLM_API_KEY is required (set it, or point VLM_BASE_URL at a local model)')
  }

  const payload = JSON.stringify({
    model: VLM_MODEL,
    max_tokens: 4096,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages,
  })

  let lastStatus = 0
  let lastDetail = ''
  for (let attempt = 0; attempt < MAX_VLM_RETRIES; attempt++) {
    const res = await fetch(`${VLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VLM_API_KEY || 'local'}`,
      },
      body: payload,
    })

    if (res.ok) {
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      return data.choices?.[0]?.message?.content ?? ''
    }

    lastStatus = res.status
    lastDetail = (await res.text().catch(() => '')).slice(0, 300)

    // Retry transient failures (rate-limit / overload / 5xx) with exponential backoff.
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_VLM_RETRIES - 1) {
      console.warn(`   VLM ${res.status}, retrying (attempt ${attempt + 1}/${MAX_VLM_RETRIES})...`)
      await sleep(800 * 2 ** attempt)
      continue
    }
    break
  }

  throw new Error(`VLM request failed: ${lastStatus} ${lastDetail}`)
}

function sanitizeAnalysisBody(input: unknown): AnalysisBody {
  const data = asRecord(input)
  return {
    transcript: sanitizeTranscript(data.transcript),
    claims: sanitizeClaims(data.claims),
    discrepancies: sanitizeDiscrepancies(data.discrepancies),
  }
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
    .slice(0, MAX_TRANSCRIPT)
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
    .slice(0, MAX_CLAIMS)
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
    .slice(0, MAX_DISCREPANCIES)
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
    const parsed = tryParseJson(text.slice(start, end + 1))
    if (parsed !== null) return parsed
  }

  // Model returned prose / no JSON — degrade to an empty result instead of throwing,
  // so a valid reel shows the empty state rather than a red "Analysis Error" card.
  console.warn('   VLM response was not valid JSON; returning empty analysis')
  return {}
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
