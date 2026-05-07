import { FastifyError, FastifyRequest, FastifyReply } from 'fastify'

export default function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const statusCode = error.statusCode || 500
  if (statusCode >= 500) {
    request.log.error({ err: error }, 'Unhandled error')
  }
  reply.status(statusCode).send({ error: error.message || 'Internal Server Error' })
}
