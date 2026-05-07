import { FastifyRequest, FastifyReply } from 'fastify'

export async function startSession(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { subjectId, type, pomodoroRound } = request.body as {
    subjectId: string
    type: 'FOCUS' | 'POMODORO'
    pomodoroRound?: number
  }

  const prisma = request.server.prisma
  const data: any = { userId, subjectId, type }
  if (pomodoroRound !== undefined) data.pomodoroRound = pomodoroRound

  const session = await prisma.session.create({ data })
  return reply.status(201).send({ data: { session } })
}

export async function updateSession(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const body = request.body as { endedAt?: string; durationSeconds?: number }

  const prisma = request.server.prisma
  const data: any = {}
  if (body.endedAt) data.endedAt = new Date(body.endedAt)
  if (body.durationSeconds !== undefined) data.durationSeconds = body.durationSeconds

  const session = await prisma.session.update({ where: { id }, data })

  return reply.send({ data: { session } })
}

export async function completeSession(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const body = request.body as { durationSeconds?: number; note?: string }

  const prisma = request.server.prisma
  const existing = await prisma.session.findUnique({ where: { id } })
  if (!existing) {
    return reply.status(404).send({ error: 'Session not found' })
  }

  const endedAt = new Date()
  // Use provided duration; fall back to elapsed time since startedAt
  const durationSeconds = body.durationSeconds !== undefined
    ? body.durationSeconds
    : Math.floor((endedAt.getTime() - existing.startedAt.getTime()) / 1000)

  const session = await prisma.session.update({
    where: { id },
    data: {
      endedAt,
      durationSeconds,
      ...(body.note !== undefined && { note: body.note.trim() }),
    },
  })

  // Notify group members that this user's session ended
  try {
    const userId = request.user.id
    const membership = await prisma.groupMember.findFirst({ where: { userId } })
    if (membership) {
      const io = request.server.io
      const room = `group_${membership.groupId}`
      io.of('/groups').to(room).emit('member_status_update', {
        userId,
        status: 'idle',
        elapsedSeconds: 0,
      })
      io.of('/groups').to(room).emit('leaderboard_update')
    }
  } catch (_) {}

  return reply.send({ data: { session } })
}

export async function manualSession(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { subjectId, startedAt: startedAtStr, endedAt: endedAtStr, note } = request.body as {
    subjectId: string
    startedAt: string
    endedAt: string
    note?: string
  }

  const startedAt = new Date(startedAtStr)
  const endedAt = new Date(endedAtStr)
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  if (endedAt <= startedAt) {
    return reply.status(400).send({ error: 'endedAt must be after startedAt' })
  }

  const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)
  if (durationSeconds > 43200) {
    return reply.status(400).send({ error: 'Session duration cannot exceed 12 hours' })
  }

  if (startedAt > now) {
    return reply.status(400).send({ error: 'startedAt cannot be in the future' })
  }

  if (startedAt < thirtyDaysAgo) {
    return reply.status(400).send({ error: 'startedAt cannot be more than 30 days in the past' })
  }

  const prisma = request.server.prisma
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } })
  if (!subject) {
    return reply.status(404).send({ error: 'Subject not found' })
  }

  const session = await prisma.session.create({
    data: {
      userId,
      subjectId,
      startedAt,
      endedAt,
      durationSeconds,
      type: 'FOCUS',
      ...(note !== undefined && { note: note.trim() }),
    },
  })

  return reply.status(201).send({ data: { session, durationSeconds } })
}

export async function listSessions(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { subjectId } = request.query as { subjectId?: string }
  const prisma = request.server.prisma

  const sessions = await prisma.session.findMany({
    where: { userId, ...(subjectId ? { subjectId } : {}) },
    orderBy: { startedAt: 'desc' }
  })

  return reply.send({ data: { sessions } })
}

export async function getTodaySessions(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const prisma = request.server.prisma

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const sessions = await prisma.session.findMany({
    where: { userId, startedAt: { gte: todayStart }, durationSeconds: { not: null } },
    include: { subject: { select: { name: true } } },
    orderBy: { startedAt: 'asc' }
  })

  const todaySessions = sessions.map(s => ({
    id: s.id,
    subjectId: s.subjectId,
    subjectName: s.subject.name,
    startedAt: s.startedAt,
    elapsedSeconds: s.durationSeconds
  }))

  return reply.send({ data: { sessions: todaySessions } })
}
