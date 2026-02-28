import { FastifyInstance } from 'fastify'
import { AnalyzeReelRequest, AnalyzeReelResponse } from './types.js'
import { analyzeReel } from './video-analyzer.js'

const reelCache = new Map<string, AnalyzeReelResponse>()

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
      reelCache.set(body.reelId, result)
      return reply.send(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (
        message.includes('required') ||
        message.includes('valid URL') ||
        message.includes('No frames extracted')
      ) {
        return reply.status(400).send({ error: message })
      }
      return reply.status(500).send({ error: message })
    }
  })

  fastify.get<{ Params: { reelId: string } }>('/v1/reel/:reelId', async (req, reply) => {
    const cached = reelCache.get(req.params.reelId)
    if (!cached) {
      return reply.status(404).send({ cached: false })
    }
    return reply.send({ cached: true, ...cached })
  })
}
