import dotenv from 'dotenv'
dotenv.config({ path: new URL('../../.env', import.meta.url).pathname })
import Fastify from 'fastify'
import { processReelRoute } from './process-reel.js'

const server = Fastify({ logger: true })

server.register(processReelRoute)

server.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' }, (err) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})
