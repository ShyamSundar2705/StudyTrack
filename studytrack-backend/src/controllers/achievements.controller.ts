import { FastifyRequest, FastifyReply } from 'fastify'

export async function listAchievements(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const prisma = request.server.prisma

  const achievements = await prisma.achievement.findMany({
    where: { userId: id },
    orderBy: { unlockedAt: 'desc' }
  })

  return reply.send({ data: { achievements } })
}
