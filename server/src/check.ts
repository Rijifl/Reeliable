// POST /v1/check — main SSE endpoint
import { FastifyInstance } from 'fastify'
import { CheckRequest, SSEEvent } from './types.js'
import { extractClaims } from './claim-extractor.js'
import { retrieveEvidence } from './retriever.js'
import { composeVerdict } from './verdict-composer.js'

export async function checkRoute(fastify: FastifyInstance) {
  fastify.post<{ Body: CheckRequest }>('/v1/check', async (req, reply) => {
    const { reelId, text, source, creator } = req.body

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    const send = (event: SSEEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    try {
      // Stage 1: Extract claims
      const claims = await extractClaims({ text, source, creator })

      if (claims.length === 0) {
        send({ type: 'no_claims' })
        reply.raw.end()
        return
      }

      for (const claim of claims) {
        send({ type: 'claim_detected', claim })

        // Stage 2: Retrieve evidence
        const sources = await retrieveEvidence(claim)

        // Stage 3: Compose verdict
        const verdict = await composeVerdict(claim, sources)
        send({ type: 'verdict', verdict })
      }
    } catch (err) {
      send({ type: 'error', message: String(err) })
    }

    reply.raw.end()
  })
}
