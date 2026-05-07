import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { startSession, updateSession, completeSession, manualSession, listSessions, getTodaySessions } from '../controllers/sessions.controller'

export default async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/sessions/start', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['subjectId', 'type'],
        properties: {
          subjectId:     { type: 'string' },
          type:          { type: 'string', enum: ['FOCUS', 'POMODORO'] },
          pomodoroRound: { type: 'integer', minimum: 1 },
        }
      }
    }
  }, startSession)

  fastify.patch('/sessions/:id', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        properties: {
          endedAt: { type: 'string' },
          durationSeconds: { type: 'integer', minimum: 0 }
        }
      }
    }
  }, updateSession)

  fastify.post('/sessions/:id/complete', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        properties: {
          durationSeconds: { type: 'integer', minimum: 0 },
          note:            { type: 'string', maxLength: 500 },
        }
      }
    }
  }, completeSession)

  fastify.post('/sessions/manual', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['subjectId', 'startedAt', 'endedAt'],
        properties: {
          subjectId: { type: 'string' },
          startedAt: { type: 'string' },
          endedAt:   { type: 'string' },
          note:      { type: 'string', maxLength: 200 },
        }
      }
    }
  }, manualSession)

  fastify.get('/sessions/today', { preHandler: authenticate }, getTodaySessions)

  fastify.get('/sessions', { preHandler: authenticate }, listSessions)
}
