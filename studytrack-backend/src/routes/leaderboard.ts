import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { getLeaderboard } from '../controllers/leaderboard.controller'

export default async function leaderboardRoutes(fastify: FastifyInstance) {
  fastify.get('/leaderboard', { preHandler: authenticate }, getLeaderboard)
}
