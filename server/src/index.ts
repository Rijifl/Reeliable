import dotenv from 'dotenv'
import path from 'path'

dotenv.config()
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { analyzeReelRoute } from './analyze-reel.js'

const server = Fastify({ logger: true })

server.register(cors, { origin: true })
server.register(analyzeReelRoute)

server.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' }, (err) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})
