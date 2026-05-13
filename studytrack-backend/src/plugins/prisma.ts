import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Monotonically increasing counter gives each prepared statement a unique name.
// Hash-based names collide when a pooled connection is reused: Prisma tries to
// PREPARE the same name again on a connection that already has it, causing
// "prepared statement already exists". A unique name per execution avoids this.
// Statements accumulate on each connection but are freed when the connection closes.
let _psSeq = 0

async function prismaPlugin(fastify: FastifyInstance) {
  // DATABASE_URL is a direct postgres:// TCP connection string (from `npx prisma dev`).
  // Prisma Client 7.8.0 does not support the prisma+postgres:// HTTP protocol with
  // this version of `prisma dev` — use @prisma/adapter-pg for direct TCP instead.
  const adapter = new PrismaPg(process.env.DATABASE_URL!, {
    statementNameGenerator: () => `ps_${(_psSeq++ >>> 0).toString(36)}`,
  })
  const prisma = new PrismaClient({ adapter })

  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
}

export default fp(prismaPlugin)
