import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Stable hash of SQL text → unique statement name.
// Avoids the unnamed-prepared-statement ('') race where concurrent requests
// sharing the same backend connection overwrite each other's PARSE, causing
// "bind message supplies N parameters, but prepared statement '' requires M".
function sqlHash(sql: string): string {
  let h = 5381
  for (let i = 0; i < sql.length; i++) h = (Math.imul(h, 33) ^ sql.charCodeAt(i)) | 0
  return 'ps_' + (h >>> 0).toString(36)
}

async function prismaPlugin(fastify: FastifyInstance) {
  // DATABASE_URL is a direct postgres:// TCP connection string (from `npx prisma dev`).
  // Prisma Client 7.8.0 does not support the prisma+postgres:// HTTP protocol with
  // this version of `prisma dev` — use @prisma/adapter-pg for direct TCP instead.
  const adapter = new PrismaPg(process.env.DATABASE_URL!, {
    statementNameGenerator: (query) => sqlHash(query.sql),
  })
  const prisma = new PrismaClient({ adapter })

  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
}

export default fp(prismaPlugin)
