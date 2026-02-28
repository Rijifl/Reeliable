import { AnalyzeReelRequest, AnalyzeReelResponse } from './types.js'
import { analyzeVideo } from './openrouter.js'
import { extractFramesFromVideoUrl } from './video-processor.js'

export async function analyzeReel(request: AnalyzeReelRequest): Promise<AnalyzeReelResponse> {
  validateRequest(request)

  console.log(`\n── analyzeReel: ${request.reelId} ──`)
  console.log(`   videoUrl: ${request.videoUrl.slice(0, 80)}...`)

  const frames = await extractFramesFromVideoUrl(
    request.videoUrl,
    { intervalSeconds: 2, maxFrames: 15 },
    request.imageUrls,
  )

  console.log(`   frames extracted: ${frames.length}`)

  if (frames.length === 0) {
    throw new Error('No frames extracted from video URL')
  }

  const body = await analyzeVideo(frames, request.creator, request.caption)

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
  if (!request.reelId) {
    throw new Error('reelId is required')
  }
  if (!request.videoUrl) {
    throw new Error('videoUrl is required')
  }
  try {
    const url = new URL(request.videoUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('videoUrl must be http/https')
    }
  } catch {
    throw new Error('videoUrl must be a valid URL')
  }
}
