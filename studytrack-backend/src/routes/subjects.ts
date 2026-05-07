import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { createSubject, listSubjects, deleteSubject } from '../controllers/subjects.controller'

export default async function subjectRoutes(fastify: FastifyInstance) {
  fastify.post('/subjects', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['name', 'colorHex'],
        properties: {
          name: { type: 'string', minLength: 1 },
          colorHex: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' }
        }
      }
    }
  }, createSubject)

  fastify.get('/subjects', { preHandler: authenticate }, listSubjects)

  fastify.delete('/subjects/:id', { preHandler: authenticate }, deleteSubject)
}
