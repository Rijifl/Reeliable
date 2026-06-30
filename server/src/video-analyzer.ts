import { AnalyzeReelRequest, AnalyzeReelResponse } from './types.js'
import { analyzeVideo } from './vlm.js'
import { extractFramesFromVideoUrl, ExtractedFrame } from './video-processor.js'
import { groundClaims, groundingEnabled } from './grounding.js'
import { ValidationError } from './errors.js'

export async function analyzeReel(request: AnalyzeReelRequest): Promise<AnalyzeReelResponse> {
  validateRequest(request)

  console.log(`\n── analyzeReel: ${request.reelId} ──`)

  let frames: ExtractedFrame[]
  let whisperTranscript: string | undefined

  if (request.frames && request.frames.length > 0) {
    // Frames captured in the browser (authenticated tab) — no server-side download,
    // so no yt-dlp and no Instagram cookies are required.
    frames = request.frames
    console.log(`   using ${frames.length} browser-captured frame(s) — no download`)
  } else {
    console.log(`   videoUrl: ${request.videoUrl.slice(0, 80)}...`)
    const extracted = await extractFramesFromVideoUrl(
      request.videoUrl,
      { intervalSeconds: 2, maxFrames: 15 },
      request.imageUrls,
    )
    frames = extracted.frames
    whisperTranscript = extracted.whisperTranscript
    console.log(`   frames extracted: ${frames.length}`)
    if (whisperTranscript) console.log(`   whisper transcript length: ${whisperTranscript.length} chars`)
  }

  if (frames.length === 0) {
    throw new Error('No frames available to analyze')
  }

  const body = await analyzeVideo(frames, request.creator, request.caption, whisperTranscript)

  if (groundingEnabled() && body.claims.length > 0) {
    console.log(`   grounding ${body.claims.length} claim(s) via Google Search...`)
    await groundClaims(body.claims)
  }

  console.log(`   transcript lines: ${body.transcript.length}`)
  console.log(`   claims: ${body.claims.length}`)
  console.log(`   discrepancies: ${body.discrepancies.length}`)
  console.log(`── done ──\n`)

  return {
    reelId: request.reelId,
    transcript: body.transcript,
    claims: body.claims,
    discrepancies: body.discrepancies,
  }
}

function validateRequest(request: AnalyzeReelRequest) {
  if (!request.reelId) throw new ValidationError('reelId is required')
  if (!request.videoUrl) throw new ValidationError('videoUrl is required')

  let url: URL
  try {
    url = new URL(request.videoUrl)
  } catch {
    throw new ValidationError('videoUrl must be a valid URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError('videoUrl must be http/https')
  }
}
