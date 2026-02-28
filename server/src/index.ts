import Fastify from 'fastify'
import { checkRoute } from './check.js'

const server = Fastify({ logger: true })

server.register(checkRoute)

server.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' }, (err) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})
