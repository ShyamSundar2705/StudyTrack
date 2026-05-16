import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

let _psSeq = Math.floor(Math.random() * 1e9)

const adapter = new PrismaPg(process.env.DATABASE_URL!, {
  statementNameGenerator: () => `ps_${(_psSeq++ >>> 0).toString(36)}`,
})

export const prisma = new PrismaClient({ adapter })
