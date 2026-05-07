import 'dotenv/config'
import './src/types'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'

import prismaPlugin from './src/plugins/prisma'
import socketPlugin from './src/plugins/socket'
import errorHandler from './src/middleware/errorHandler'

import authRoutes from './src/routes/auth'
import userRoutes from './src/routes/users'
import subjectRoutes from './src/routes/subjects'
import sessionRoutes from './src/routes/sessions'
import statsRoutes from './src/routes/stats'
import taskRoutes from './src/routes/tasks'
import leaderboardRoutes from './src/routes/leaderboard'
import achievementRoutes from './src/routes/achievements'
import groupRoutes from './src/routes/groups'
import scheduleEventRoutes from './src/routes/scheduleEvents'

const app = Fastify({ logger: true })

async function start() {
  await app.register(cors, { origin: '*' })
  await app.register(jwt, { secret: process.env.JWT_SECRET! })
  await app.register(prismaPlugin)
  await app.register(socketPlugin)

  app.setErrorHandler(errorHandler)

  app.get('/api/health', async () => ({ status: 'ok' }))

  // Auth routes under /api/auth (no authentication required)
  await app.register(authRoutes, { prefix: '/api/auth' })

  // All other routes under /api (authentication enforced per-route)
  await app.register(userRoutes, { prefix: '/api' })
  await app.register(subjectRoutes, { prefix: '/api' })
  await app.register(sessionRoutes, { prefix: '/api' })
  await app.register(statsRoutes, { prefix: '/api' })
  await app.register(taskRoutes, { prefix: '/api' })
  await app.register(leaderboardRoutes, { prefix: '/api' })
  await app.register(achievementRoutes, { prefix: '/api' })
  await app.register(groupRoutes, { prefix: '/api' })
  await app.register(scheduleEventRoutes, { prefix: '/api' })

  const port = parseInt(process.env.PORT || '3000', 10)
  await app.listen({ port, host: '0.0.0.0' })
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
