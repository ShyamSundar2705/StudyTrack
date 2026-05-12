import { FastifyRequest, FastifyReply } from 'fastify'
import type { UserPreferences } from '../../generated/prisma/client'

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  handle: true,
  avatar: true,
  dailyGoalSeconds: true,
  createdAt: true
}

function formatPrefs(prefs: UserPreferences) {
  const { id, userId, createdAt, updatedAt, longBreakAfterRounds, ...rest } = prefs
  return { ...rest, longBreakAfter: longBreakAfterRounds }
}

export async function getPreferences(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const prisma = request.server.prisma

  const prefs = await prisma.userPreferences.upsert({
    where:  { userId },
    create: { userId },
    update: {},
  })

  return reply.send({ data: { preferences: formatPrefs(prefs) } })
}

export async function updateUserPreferences(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const prisma = request.server.prisma
  const data: Record<string, any> = { ...(request.body as Record<string, any>) }

  // Strip internal fields — Fastify schema blocks them, but defense-in-depth
  delete data.id
  delete data.userId
  delete data.createdAt
  delete data.updatedAt

  if ('longBreakAfter' in data) {
    data.longBreakAfterRounds = data.longBreakAfter
    delete data.longBreakAfter
  }

  const prefs = await prisma.userPreferences.upsert({
    where:  { userId },
    create: { userId, ...data },
    update: data,
  })

  return reply.send({ data: { preferences: formatPrefs(prefs) } })
}

export async function getProfile(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const prisma = request.server.prisma

  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT })
  if (!user) {
    return reply.status(404).send({ error: 'User not found' })
  }

  return reply.send({ data: { user } })
}

export async function updatePreferences(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const body = request.body as {
    name?: string
    handle?: string
    avatar?: string
    dailyGoalSeconds?: number
  }

  const prisma = request.server.prisma
  const user = await prisma.user.update({ where: { id }, data: body, select: USER_SELECT })

  return reply.send({ data: { user } })
}

// GET /users/me — convenience wrapper using JWT userId
export async function getMe(request: FastifyRequest, reply: FastifyReply) {
  const id = request.user.id
  const prisma = request.server.prisma

  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT })
  if (!user) {
    return reply.status(404).send({ error: 'User not found' })
  }

  return reply.send({ data: { user } })
}

// PATCH /users/me — convenience wrapper using JWT userId
export async function updateMe(request: FastifyRequest, reply: FastifyReply) {
  const id = request.user.id
  const body = request.body as {
    name?: string
    handle?: string
    avatar?: string
    dailyGoalSeconds?: number
  }

  const prisma = request.server.prisma
  const user = await prisma.user.update({ where: { id }, data: body, select: USER_SELECT })

  return reply.send({ data: { user } })
}

// GET /users/me/stats — lifetime stats
export async function getStats(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const prisma = request.server.prisma

  const [sessions, totalSubjects] = await Promise.all([
    prisma.session.findMany({
      where: { userId, durationSeconds: { not: null } },
      select: { durationSeconds: true, startedAt: true }
    }),
    prisma.subject.count({ where: { userId } })
  ])

  const totalSeconds = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0)
  const totalHours = Math.round((totalSeconds / 3600) * 10) / 10
  const daysActive = new Set(sessions.map(s => s.startedAt.toISOString().split('T')[0])).size

  return reply.send({ data: { stats: { totalHours, totalSessions: sessions.length, totalSubjects, daysActive } } })
}

// GET /users/me/group — user's current group
export async function getMyGroup(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const prisma = request.server.prisma

  const membership = await prisma.groupMember.findFirst({ where: { userId } })
  if (!membership) {
    return reply.status(404).send({ error: 'Not a member of any group' })
  }

  const group = await prisma.group.findUnique({
    where: { id: membership.groupId },
    include: { members: { include: { user: true }, orderBy: { joinedAt: 'asc' } } }
  })
  if (!group) return reply.status(404).send({ error: 'Group not found' })

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const memberIds = group.members.map(m => m.userId)
  const todaySessions = await prisma.session.findMany({
    where: { userId: { in: memberIds }, startedAt: { gte: todayStart }, durationSeconds: { not: null } },
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

  return reply.send({ data: { group: { id: group.id, name: group.name, createdAt: group.createdAt, members } } })
}

// GET /users/me/insights?period=week|month|allTime   (also accepts 'all' for allTime)
export async function getInsights(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { period = 'week' } = request.query as { period?: string }
  const prisma = request.server.prisma

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const normalized = period === 'all' ? 'allTime' : period

  let startDate: Date
  let heatmapDays: number

  if (normalized === 'week') {
    heatmapDays = 7
    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6))
  } else if (normalized === 'month') {
    heatmapDays = 30
    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29))
  } else {
    heatmapDays = 365
    startDate = new Date(0)
  }

  const sessions = await prisma.session.findMany({
    where: { userId, startedAt: { gte: startDate }, durationSeconds: { not: null } },
    include: { subject: { select: { name: true, colorHex: true } } },
    orderBy: { startedAt: 'asc' },
  })

  const totalSeconds = sessions.reduce((sum: number, s: any) => sum + (s.durationSeconds || 0), 0)
  const totalSessions = sessions.length

  const dayMap: Record<string, number> = {}
  const subjectMap: Record<string, { name: string; colorHex: string; seconds: number }> = {}

  for (const s of sessions) {
    const date = s.startedAt.toISOString().split('T')[0]
    dayMap[date] = (dayMap[date] || 0) + (s.durationSeconds || 0)
    if (!subjectMap[s.subjectId]) {
      subjectMap[s.subjectId] = { name: s.subject.name, colorHex: s.subject.colorHex, seconds: 0 }
    }
    subjectMap[s.subjectId].seconds += s.durationSeconds || 0
  }

  const daysWithSessions = Object.keys(dayMap).length
  const dailyAverageSeconds = daysWithSessions > 0 ? Math.round(totalSeconds / daysWithSessions) : 0
  const bestDaySeconds = Object.values(dayMap).length > 0 ? Math.max(...Object.values(dayMap)) : 0

  // Flat heatmap array: heatmapDays entries, oldest first
  const heatmap: { date: string; seconds: number }[] = []
  for (let i = heatmapDays - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    const dateStr = d.toISOString().split('T')[0]
    heatmap.push({ date: dateStr, seconds: dayMap[dateStr] || 0 })
  }

  // dailyBreakdown: same as heatmap for week/month; 12 monthly aggregates for allTime
  let dailyBreakdown: { date: string; seconds: number }[]
  if (normalized === 'allTime') {
    dailyBreakdown = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const monthFirstDay = d.toISOString().split('T')[0]
      const monthPrefix = monthFirstDay.slice(0, 7)
      const monthSeconds = Object.entries(dayMap)
        .filter(([date]) => date.startsWith(monthPrefix))
        .reduce((sum, [, s]) => sum + s, 0)
      dailyBreakdown.push({ date: monthFirstDay, seconds: monthSeconds })
    }
  } else {
    dailyBreakdown = heatmap
  }

  // bySubject sorted by seconds desc with percentage
  const bySubject = Object.entries(subjectMap)
    .map(([id, data]) => ({
      subjectId: id,
      name: data.name,
      colorHex: data.colorHex,
      seconds: data.seconds,
      percentage: totalSeconds > 0 ? Math.round((data.seconds / totalSeconds) * 100) : 0,
    }))
    .sort((a, b) => b.seconds - a.seconds)

  // Streak: consecutive days with sessions ending today
  let streak = 0
  let checkDate = todayStr
  while (dayMap[checkDate]) {
    streak++
    const d = new Date(checkDate + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    checkDate = d.toISOString().split('T')[0]
  }

  return reply.send({ data: {
    totalSeconds,
    dailyAverageSeconds,
    bestDaySeconds,
    heatmap,
    bySubject,
    dailyBreakdown,
    streak,
    totalSessions,
  }})
}
