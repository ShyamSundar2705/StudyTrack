import { FastifyInstance } from 'fastify'
import { register, login } from '../controllers/auth.controller'
import { supabaseLogin } from '../controllers/supabase-auth.controller'

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/supabase', supabaseLogin)

  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'name', 'handle'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          name: { type: 'string', minLength: 1 },
          handle: { type: 'string', minLength: 1 },
          avatar: { type: 'string' }
        }
      }
    }
  }, register)

  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' }
        }
      }
    }
  }, login)
}
