import { FastifyRequest, FastifyReply } from 'fastify'

export async function createGroup(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { name } = request.body as { name: string }
  const prisma = request.server.prisma

  const group = await prisma.group.create({ data: { name } })
  const member = await prisma.groupMember.create({ data: { groupId: group.id, userId } })

  return reply.status(201).send({ data: { group, member } })
}

export async function getGroup(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const prisma = request.server.prisma

  const group = await prisma.group.findUnique({
    where: { id },
    include: { members: { include: { user: true }, orderBy: { joinedAt: 'asc' } } }
  })
  if (!group) return reply.status(404).send({ error: 'Group not found' })

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setUTCHours(23, 59, 59, 999)

  const memberIds = group.members.map(m => m.userId)

  const todaySessions = await prisma.session.findMany({
    where: {
      userId: { in: memberIds },
      startedAt: { gte: todayStart, lte: todayEnd },
      durationSeconds: { not: null }
    },
    select: { userId: true, durationSeconds: true }
  })

  const todayMap: Record<string, number> = {}
  for (const s of todaySessions) {
    todayMap[s.userId] = (todayMap[s.userId] || 0) + (s.durationSeconds || 0)
  }

  const members = group.members.map(m => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    handle: m.user.handle,
    avatar: m.user.avatar,
    joinedAt: m.joinedAt,
    todaySeconds: todayMap[m.userId] || 0
  }))

  return reply.send({ data: { group: { id: group.id, name: group.name, createdAt: group.createdAt }, members } })
}

export async function joinGroup(request: FastifyRequest, reply: FastifyReply) {
  const { id: groupId } = request.params as { id: string }
  const userId = request.user.id
  const prisma = request.server.prisma

  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) return reply.status(404).send({ error: 'Group not found' })

  const existing = await prisma.groupMember.findFirst({ where: { groupId, userId } })
  if (existing) return reply.status(409).send({ error: 'Already a member of this group' })

  const member = await prisma.groupMember.create({ data: { groupId, userId } })

  return reply.status(201).send({ data: { member } })
}

export async function leaveGroup(request: FastifyRequest, reply: FastifyReply) {
  const { id: groupId } = request.params as { id: string }
  const userId = request.user.id
  const prisma = request.server.prisma

  const existing = await prisma.groupMember.findFirst({ where: { groupId, userId } })
  if (!existing) return reply.status(404).send({ error: 'Not a member of this group' })

  await prisma.groupMember.delete({ where: { id: existing.id } })

  return reply.send({ data: { success: true } })
}

export async function getGroupActivity(request: FastifyRequest, reply: FastifyReply) {
  const { id: groupId } = request.params as { id: string }
  const { limit = '20' } = request.query as { limit?: string }
  const limitNum = Math.min(parseInt(limit, 10) || 20, 100)
  const prisma = request.server.prisma

  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true }
  })
  if (!groupMembers.length) return reply.send({ data: { activities: [] } })

  const memberIds = groupMembers.map(m => m.userId)
  const userMap = Object.fromEntries(groupMembers.map(m => [m.userId, m.user]))

  const [completedSessions, activeSessions, streakAchievements] = await Promise.all([
    // session_complete events — keyed by endedAt
    prisma.session.findMany({
      where: { userId: { in: memberIds }, endedAt: { not: null } },
      include: { subject: { select: { name: true, colorHex: true } } },
      orderBy: { endedAt: 'desc' },
      take: limitNum
    }),
    // session_start events — sessions that are still active (no endedAt)
    prisma.session.findMany({
      where: { userId: { in: memberIds }, endedAt: null },
      include: { subject: { select: { name: true, colorHex: true } } },
      orderBy: { startedAt: 'desc' },
      take: limitNum
    }),
    prisma.achievement.findMany({
      where: { userId: { in: memberIds }, type: { in: ['STREAK_3', 'STREAK_7'] } },
      orderBy: { unlockedAt: 'desc' },
      take: limitNum
    })
  ])

  type Activity = {
    type: string
    userId: string
    name: string
    handle: string
    avatarInitial: string
    timestamp: Date
    payload: Record<string, unknown>
  }

  const activities: Activity[] = []

  for (const s of completedSessions) {
    const user = userMap[s.userId]
    if (!user) continue
    activities.push({
      type: 'session_complete',
      userId: s.userId,
      name: user.name,
      handle: user.handle,
      avatarInitial: user.name.charAt(0).toUpperCase(),
      timestamp: s.endedAt!,
      payload: { durationSeconds: s.durationSeconds, subjectName: s.subject.name, subjectColor: s.subject.colorHex }
    })
  }

  for (const s of activeSessions) {
    const user = userMap[s.userId]
    if (!user) continue
    activities.push({
      type: 'session_start',
      userId: s.userId,
      name: user.name,
      handle: user.handle,
      avatarInitial: user.name.charAt(0).toUpperCase(),
      timestamp: s.startedAt,
      payload: { subjectName: s.subject.name, subjectColor: s.subject.colorHex }
    })
  }

  for (const a of streakAchievements) {
    const user = userMap[a.userId]
    if (!user) continue
    activities.push({
      type: 'streak_milestone',
      userId: a.userId,
      name: user.name,
      handle: user.handle,
      avatarInitial: user.name.charAt(0).toUpperCase(),
      timestamp: a.unlockedAt,
      payload: { achievementType: a.type }
    })
  }

  for (const m of groupMembers) {
    activities.push({
      type: 'member_join',
      userId: m.userId,
      name: m.user.name,
      handle: m.user.handle,
      avatarInitial: m.user.name.charAt(0).toUpperCase(),
      timestamp: m.joinedAt,
      payload: {}
    })
  }

  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return reply.send({ data: { activities: activities.slice(0, limitNum) } })
}

export async function getGroupLeaderboard(request: FastifyRequest, reply: FastifyReply) {
  const { id: groupId } = request.params as { id: string }
  const { period = 'today' } = request.query as { period?: string }
  const prisma = request.server.prisma

  const now = new Date()
  let rangeStart: Date

  if (period === 'week') {
    rangeStart = new Date(now)
    const day = rangeStart.getUTCDay() // 0 = Sunday
    rangeStart.setUTCDate(rangeStart.getUTCDate() - day)
    rangeStart.setUTCHours(0, 0, 0, 0)
  } else if (period === 'month') {
    rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  } else {
    // today (default)
    rangeStart = new Date(now)
    rangeStart.setUTCHours(0, 0, 0, 0)
  }

  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true }
  })
  if (!groupMembers.length) return reply.send({ data: { leaderboard: [] } })

  const memberIds = groupMembers.map(m => m.userId)
  const userMap = Object.fromEntries(groupMembers.map(m => [m.userId, m.user]))

  const sessions = await prisma.session.findMany({
    where: {
      userId: { in: memberIds },
      startedAt: { gte: rangeStart },
      durationSeconds: { not: null }
    },
    include: { subject: { select: { name: true, colorHex: true } } }
  })

  // Aggregate per user — total duration + top subject
  const aggMap: Record<string, {
    durationSeconds: number
    subjectTotals: Record<string, { name: string; colorHex: string; seconds: number }>
  }> = {}

  for (const s of sessions) {
    if (!aggMap[s.userId]) aggMap[s.userId] = { durationSeconds: 0, subjectTotals: {} }
    aggMap[s.userId].durationSeconds += s.durationSeconds || 0
    const st = aggMap[s.userId].subjectTotals
    if (!st[s.subjectId]) st[s.subjectId] = { name: s.subject.name, colorHex: s.subject.colorHex, seconds: 0 }
    st[s.subjectId].seconds += s.durationSeconds || 0
  }

  const entries = memberIds.map(userId => {
    const user = userMap[userId]
    const agg = aggMap[userId]
    const topSubject = agg
      ? Object.values(agg.subjectTotals).sort((a, b) => b.seconds - a.seconds)[0]
      : undefined
    return {
      userId,
      name: user.name,
      handle: user.handle,
      avatarInitial: user.name.charAt(0).toUpperCase(),
      durationSeconds: agg?.durationSeconds ?? 0,
      subjectName: topSubject?.name ?? '',
      subjectColor: topSubject?.colorHex ?? ''
    }
  })

  entries.sort((a, b) => b.durationSeconds - a.durationSeconds)

  const leaderboard = entries.map((entry, i) => ({
    ...entry,
    rank: i + 1,
    rankChange: 0 // no historical snapshots available for comparison
  }))

  return reply.send({ data: { leaderboard } })
}
