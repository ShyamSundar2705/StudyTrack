import { FastifyRequest, FastifyReply } from 'fastify'

export async function getHeatmap(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { month } = request.query as { month: string }

  // month is YYYY-MM; build UTC range for that calendar month
  const startDate = new Date(`${month}-01T00:00:00.000Z`)
  const endDate = new Date(startDate)
  endDate.setUTCMonth(endDate.getUTCMonth() + 1)

  const prisma = request.server.prisma
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      startedAt: { gte: startDate, lt: endDate },
      durationSeconds: { not: null }
    },
    select: { startedAt: true, durationSeconds: true }
  })

  const map: Record<string, number> = {}
  for (const s of sessions) {
    const date = s.startedAt.toISOString().split('T')[0]
    map[date] = (map[date] || 0) + (s.durationSeconds || 0)
  }

  const heatmap = Object.entries(map)
    .map(([date, seconds]) => ({ date, seconds }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return reply.send({ data: { heatmap } })
}
