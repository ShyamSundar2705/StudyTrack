import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import {
  listScheduleEvents,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
} from '../controllers/scheduleEvents.controller'

export default async function scheduleEventRoutes(fastify: FastifyInstance) {
  fastify.get('/schedule-events', { preHandler: authenticate }, listScheduleEvents)

  fastify.post('/schedule-events', {
    schema: {
      body: {
        type: 'object',
        required: ['title', 'date', 'startTime'],
        properties: {
          title:           { type: 'string', minLength: 1, maxLength: 200 },
          date:            { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          startTime:       { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          durationMinutes: { type: 'integer', minimum: 1 },
          subjectId:       { type: 'string' },
          isRecurring:     { type: 'boolean' },
          recurringDays:   { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
          color:           { type: 'string' },
        },
      }
    },
    preHandler: authenticate,
  }, createScheduleEvent)

  fastify.patch('/schedule-events/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          title:           { type: 'string', minLength: 1, maxLength: 200 },
          date:            { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          startTime:       { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          durationMinutes: { type: 'integer', minimum: 1 },
          subjectId:       { type: ['string', 'null'] },
          isRecurring:     { type: 'boolean' },
          recurringDays:   { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
          color:           { type: ['string', 'null'] },
        },
      }
    },
    preHandler: authenticate,
  }, updateScheduleEvent)

  fastify.delete('/schedule-events/:id', { preHandler: authenticate }, deleteScheduleEvent)
}
