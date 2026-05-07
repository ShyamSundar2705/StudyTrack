import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

async function prismaPlugin(fastify: FastifyInstance) {
  // DATABASE_URL is a direct postgres:// TCP connection string (from `npx prisma dev`).
  // Prisma Client 7.8.0 does not support the prisma+postgres:// HTTP protocol with
  // this version of `prisma dev` — use @prisma/adapter-pg for direct TCP instead.
  const adapter = new PrismaPg(process.env.DATABASE_URL!)
  const prisma = new PrismaClient({ adapter })

  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
}

export default fp(prismaPlugin)
