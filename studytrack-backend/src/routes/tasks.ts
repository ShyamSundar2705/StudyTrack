import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { listTasks, createTask, updateTask, deleteTask } from '../controllers/tasks.controller'

export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.get('/tasks', { preHandler: authenticate }, listTasks)

  fastify.post('/tasks', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1 },
          subjectId: { type: 'string' },
          dueDate: { type: 'string' }
        }
      }
    }
  }, createTask)

  fastify.patch('/tasks/:id', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          subjectId: { type: ['string', 'null'] },
          estimatedMinutes: { type: ['integer', 'null'] },
          completed: { type: 'boolean' },
          completedAt: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}' },
          carriedOver: { type: 'boolean' },
          dueDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}' }
        }
      }
    }
  }, updateTask)

  fastify.delete('/tasks/:id', { preHandler: authenticate }, deleteTask)
}
