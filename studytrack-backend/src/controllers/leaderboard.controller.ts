import { FastifyRequest, FastifyReply } from 'fastify'

export async function getLeaderboard(request: FastifyRequest, reply: FastifyReply) {
  const { scope, groupId } = request.query as { scope: string; groupId?: string }
  const prisma = request.server.prisma

  if (scope === 'group') {
    if (!groupId) {
      return reply.status(400).send({ error: 'groupId is required for group scope' })
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          include: {
            // All-time totals; add a date range filter here when week/month scopes are needed
            sessions: {
              where: { durationSeconds: { not: null } },
              select: { durationSeconds: true }
            }
          }
        }
      }
    })

    const leaderboard = members
      .map(m => ({
        userId: m.userId,
        name: m.user.name,
        handle: m.user.handle,
        avatar: m.user.avatar,
        totalSeconds: m.user.sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0)
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds)

    return reply.send({ data: { leaderboard } })
  }

  return reply.status(400).send({ error: `Unsupported scope: ${scope}` })
}
