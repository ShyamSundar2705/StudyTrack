import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { Server } from 'socket.io'
import { registerGroupSocketHandlers } from '../socket/groups.socket'

async function socketPlugin(fastify: FastifyInstance) {
  const io = new Server(fastify.server, {
    cors: { origin: '*' }
  })

  registerGroupSocketHandlers(io, fastify.prisma)

  fastify.decorate('io', io)

  fastify.addHook('onClose', async () => {
    io.close()
  })
}

export default fp(socketPlugin)
