import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import {
  createGroup,
  getGroup,
  joinGroup,
  joinByCode,
  searchGroups,
  leaveGroup,
  getGroupActivity,
  getGroupLeaderboard,
  updateGroup,
  regenerateCode,
  deleteGroup
} from '../controllers/groups.controller'

export default async function groupRoutes(fastify: FastifyInstance) {
  fastify.post('/groups', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
          isPublic: { type: 'boolean' },
          maxMembers: { type: 'integer', minimum: 2, maximum: 100 }
        }
      }
    }
  }, createGroup)

  fastify.post('/groups/join-by-code', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['inviteCode'],
        properties: {
          inviteCode: { type: 'string', minLength: 1, maxLength: 10 }
        }
      }
    }
  }, joinByCode)

  fastify.get('/groups/search', { preHandler: authenticate }, searchGroups)

  fastify.post('/groups/:id/regenerate-code', { preHandler: authenticate }, regenerateCode)

  fastify.get('/groups/:id', { preHandler: authenticate }, getGroup)

  fastify.post('/groups/:id/join', { preHandler: authenticate }, joinGroup)

  fastify.delete('/groups/:id/leave', { preHandler: authenticate }, leaveGroup)

  fastify.get('/groups/:id/activity', { preHandler: authenticate }, getGroupActivity)

  fastify.get('/groups/:id/leaderboard', { preHandler: authenticate }, getGroupLeaderboard)

  fastify.patch('/groups/:id', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
          isPublic: { type: 'boolean' },
          maxMembers: { type: 'integer', minimum: 2, maximum: 100 }
        },
        additionalProperties: false
      }
    }
  }, updateGroup)

  fastify.delete('/groups/:id', {
    preHandler: authenticate,
    schema: {
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      }
    }
  }, deleteGroup)
}
