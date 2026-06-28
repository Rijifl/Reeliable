import { AnalyzeReelRequest, AnalyzeReelResponse } from './types.js'
import { analyzeVideo } from './vlm.js'
import { extractFramesFromVideoUrl } from './video-processor.js'
import { groundClaims, groundingEnabled } from './grounding.js'
import { ValidationError } from './errors.js'

export async function analyzeReel(request: AnalyzeReelRequest): Promise<AnalyzeReelResponse> {
  validateRequest(request)

  console.log(`\n── analyzeReel: ${request.reelId} ──`)
  console.log(`   videoUrl: ${request.videoUrl.slice(0, 80)}...`)

  const { frames, whisperTranscript } = await extractFramesFromVideoUrl(
    request.videoUrl,
    { intervalSeconds: 2, maxFrames: 15 },
    request.imageUrls,
  )

  console.log(`   frames extracted: ${frames.length}`)
  if (whisperTranscript) console.log(`   whisper transcript length: ${whisperTranscript.length} chars`)

  if (frames.length === 0) {
    throw new Error('No frames extracted from video URL')
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
