import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { listAchievements } from '../controllers/achievements.controller'

export default async function achievementRoutes(fastify: FastifyInstance) {
  fastify.get('/users/:id/achievements', { preHandler: authenticate }, listAchievements)
}
