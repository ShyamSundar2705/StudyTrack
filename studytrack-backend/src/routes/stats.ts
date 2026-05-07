import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { getHeatmap } from '../controllers/stats.controller'

export default async function statsRoutes(fastify: FastifyInstance) {
  fastify.get('/stats/heatmap', { preHandler: authenticate }, getHeatmap)
}
