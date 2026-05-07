import { FastifyRequest, FastifyReply } from 'fastify'

export async function createSubject(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { name, colorHex } = request.body as { name: string; colorHex: string }

  const prisma = request.server.prisma
  const subject = await prisma.subject.create({ data: { userId, name, colorHex } })

  return reply.status(201).send({ data: { subject } })
}

export async function listSubjects(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const prisma = request.server.prisma

  const subjects = await prisma.subject.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' }
  })

  return reply.send({ data: { subjects } })
}

export async function deleteSubject(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const prisma = request.server.prisma

  await prisma.subject.delete({ where: { id } })

  return reply.send({ data: { success: true } })
}
