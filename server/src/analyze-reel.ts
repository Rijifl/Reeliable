import { FastifyInstance } from 'fastify'
import { AnalyzeReelRequest, AnalyzeReelResponse } from './types.js'
import { analyzeReel } from './video-analyzer.js'
import { ValidationError } from './errors.js'

const MAX_CACHE = 100
const reelCache = new Map<string, AnalyzeReelResponse>()

function cacheReel(reelId: string, result: AnalyzeReelResponse) {
  reelCache.set(reelId, result)
  // Bound the cache — evict the oldest entry (Map preserves insertion order).
  if (reelCache.size > MAX_CACHE) {
    const oldest = reelCache.keys().next().value
    if (oldest !== undefined) reelCache.delete(oldest)
  }
}

export async function analyzeReelRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: AnalyzeReelRequest }>('/v1/analyze-reel', async (req, reply) => {
    const body = req.body

    if (!body?.reelId || !body?.videoUrl) {
      return reply.status(400).send({ error: 'reelId and videoUrl are required' })
    }

    console.log(`\n→ POST /v1/analyze-reel  reelId=${body.reelId}  videoUrl=${body.videoUrl.slice(0, 60)}...`)

    const cached = reelCache.get(body.reelId)
    if (cached) {
      return reply.send(cached)
    }

    try {
      const result = await analyzeReel(body)
      cacheReel(body.reelId, result)
      return reply.send(result)
    } catch (err) {
      if (err instanceof ValidationError) {
        return reply.status(400).send({ error: err.message })
      }
      req.log.error(err)
      const message = err instanceof Error ? err.message : String(err)
      return reply.status(500).send({ error: message })
    }
  })

}
