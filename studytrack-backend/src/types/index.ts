import { PrismaClient } from '../../generated/prisma/client'
import { Server } from 'socket.io'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    io: Server
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id: string
      email: string
      supabaseUid?: string
    }
  }
}
