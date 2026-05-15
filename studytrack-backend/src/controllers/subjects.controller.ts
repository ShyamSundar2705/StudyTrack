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

  const sessionAggs = await prisma.session.groupBy({
    by: ['subjectId'],
    where: { userId, subjectId: { in: subjects.map((s: any) => s.id) }, durationSeconds: { not: null } },
    _sum: { durationSeconds: true },
  })

  const secondsMap: Record<string, number> = {}
  for (const agg of sessionAggs) {
    secondsMap[agg.subjectId] = agg._sum.durationSeconds ?? 0
  }

  const result = subjects.map((s: any) => ({ ...s, totalSeconds: secondsMap[s.id] ?? 0 }))

  return reply.send({ data: { subjects: result } })
}

export async function deleteSubject(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const prisma = request.server.prisma

  await prisma.subject.delete({ where: { id } })

  return reply.send({ data: { success: true } })
}
