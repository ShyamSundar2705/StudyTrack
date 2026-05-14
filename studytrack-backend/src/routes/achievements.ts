import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { listAchievements, listMyAchievements } from '../controllers/achievements.controller'

export default async function achievementRoutes(fastify: FastifyInstance) {
  // /me route must be registered before /:id to avoid "me" being captured as a param
  fastify.get('/users/me/achievements', { preHandler: authenticate }, listMyAchievements)
  fastify.get('/users/:id/achievements', { preHandler: authenticate }, listAchievements)
}
