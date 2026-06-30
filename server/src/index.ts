import dotenv from 'dotenv'
import path from 'path'

dotenv.config()
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { analyzeReelRoute } from './analyze-reel.js'

// Raised body limit: the extension can POST browser-captured frames (base64 JPEGs).
const server = Fastify({ logger: true, bodyLimit: 25 * 1024 * 1024 })

server.register(cors, { origin: true })
server.register(analyzeReelRoute)

server.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' }, (err) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})
