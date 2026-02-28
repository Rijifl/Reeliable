// POST /v1/process-reel — full pipeline: transcript → claims → Claude web search → verdicts
import { FastifyInstance } from 'fastify'
import { ProcessReelRequest, ProcessReelResponse, CheckedClaim } from './types.js'
import { extractClaims } from './claim-extractor.js'
import { checkClaim } from './claim-checker.js'

// In-memory cache: reelId → processed results
// Replace with Redis for production
const reelCache = new Map<string, ProcessReelResponse>()

export async function processReelRoute(fastify: FastifyInstance) {
  // Main processing endpoint
  fastify.post<{ Body: ProcessReelRequest }>('/v1/process-reel', async (req, reply) => {
    const { reelId, creator, transcript } = req.body

    // Return cached result immediately if available
    const cached = reelCache.get(reelId)
    if (cached) {
      return reply.send(cached)
    }

    // Stage 1: Extract all claims with timestamps from the full transcript
    const claims = await extractClaims(transcript, creator)

    if (claims.length === 0) {
      const result: ProcessReelResponse = { reelId, checkedClaims: [] }
      reelCache.set(reelId, result)
      return reply.send(result)
    }

    // Stage 2: For each claim, Claude searches the web and writes the verdict in one call
    const checkedClaims: CheckedClaim[] = await Promise.all(
      claims.map(async (claim) => {
        const verdict = await checkClaim(claim)
        return { claim, verdict }
      })
    )

    // Sort by timestamp so overlay can show claims in order
    checkedClaims.sort((a, b) => a.claim.timestamp_ms - b.claim.timestamp_ms)

    const result: ProcessReelResponse = { reelId, checkedClaims }
    reelCache.set(reelId, result)
    return reply.send(result)
  })

  // Cache check endpoint — extension polls this before processing a reel
  fastify.get<{ Params: { reelId: string } }>('/v1/reel/:reelId', async (req, reply) => {
    const cached = reelCache.get(req.params.reelId)
    if (!cached) return reply.status(404).send({ cached: false })
    return reply.send({ cached: true, ...cached })
  })
}
