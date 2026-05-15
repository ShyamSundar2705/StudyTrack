import { FastifyRequest, FastifyReply } from 'fastify'

async function checkAndGrantAchievements(userId: string, session: any, prisma: any) {
  try {
    const existing = await prisma.achievement.findMany({ where: { userId }, select: { type: true } })
    const earned = new Set(existing.map((a: any) => a.type))
    const toGrant: string[] = []

    const sessionCount = await prisma.session.count({ where: { userId, durationSeconds: { not: null } } })
    if (sessionCount >= 1  && !earned.has('FIRST_SESSION')) toGrant.push('FIRST_SESSION')
    if (sessionCount >= 10 && !earned.has('SESSIONS_10'))   toGrant.push('SESSIONS_10')

    const totalAgg = await prisma.session.aggregate({
      where: { userId, durationSeconds: { not: null } },
      _sum: { durationSeconds: true },
    })
    const totalSeconds = totalAgg._sum.durationSeconds ?? 0
    if (totalSeconds >= 3600   && !earned.has('TOTAL_1H'))   toGrant.push('TOTAL_1H')
    if (totalSeconds >= 36000  && !earned.has('TOTAL_10H'))  toGrant.push('TOTAL_10H')
    if (totalSeconds >= 180000 && !earned.has('TOTAL_50H'))  toGrant.push('TOTAL_50H')
    if (totalSeconds >= 360000 && !earned.has('TOTAL_100H')) toGrant.push('TOTAL_100H')

    const startHour = new Date(session.startedAt).getUTCHours()
    if (startHour < 6 && !earned.has('EARLY_BIRD')) toGrant.push('EARLY_BIRD')

    if (session.endedAt) {
      const endHour = new Date(session.endedAt).getUTCHours()
      if (endHour < 5 && !earned.has('NIGHT_OWL')) toGrant.push('NIGHT_OWL')
    }

    const allSessions = await prisma.session.findMany({
      where: { userId, durationSeconds: { not: null } },
      select: { startedAt: true },
    })
    const daySet = new Set(allSessions.map((s: any) => s.startedAt.toISOString().split('T')[0]))
    const todayStr = new Date().toISOString().split('T')[0]
    let streak = 0
    let checkDate = todayStr
    while (daySet.has(checkDate)) {
      streak++
      const d = new Date(checkDate + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() - 1)
      checkDate = d.toISOString().split('T')[0]
    }
    if (streak >= 3  && !earned.has('STREAK_3'))  toGrant.push('STREAK_3')
    if (streak >= 7  && !earned.has('STREAK_7'))  toGrant.push('STREAK_7')
    if (streak >= 21 && !earned.has('STREAK_21')) toGrant.push('STREAK_21')

    if (toGrant.length > 0) {
      await prisma.achievement.createMany({
        data: toGrant.map((type: string) => ({ userId, type })),
      })
    }
  } catch (_) {}
}

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

  const sessionUserId = request.user.id
  await checkAndGrantAchievements(sessionUserId, session, prisma)

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

  await checkAndGrantAchievements(userId, session, prisma)

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
  const { date } = request.query as { date?: string }
  const prisma = request.server.prisma

  let dayStart: Date
  let dayEnd: Date

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    dayStart = new Date(date + 'T00:00:00.000Z')
    dayEnd   = new Date(date + 'T23:59:59.999Z')
  } else {
    dayStart = new Date()
    dayStart.setUTCHours(0, 0, 0, 0)
    dayEnd = new Date()
    dayEnd.setUTCHours(23, 59, 59, 999)
  }

  const sessions = await prisma.session.findMany({
    where: { userId, startedAt: { gte: dayStart, lte: dayEnd }, durationSeconds: { not: null } },
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
