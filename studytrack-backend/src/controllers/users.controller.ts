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

function fmtSeconds(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Build a 5×7 heatmap grid of intensity strings matching the frontend INT keys
function buildHeatmapGrid(dayMap: Record<string, number>, anchorDate: Date): string[][] {
  const maxSeconds = Math.max(...Object.values(dayMap), 1)
  // 35 days ending on anchorDate (today), arranged newest at bottom-right
  const days: string[] = []
  for (let i = 34; i >= 0; i--) {
    const d = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), anchorDate.getUTCDate() - i))
    days.push(d.toISOString().split('T')[0])
  }
  const grid: string[][] = []
  for (let row = 0; row < 5; row++) {
    const rowData: string[] = []
    for (let col = 0; col < 7; col++) {
      const seconds = dayMap[days[row * 7 + col]] || 0
      if (seconds === 0) { rowData.push('empty'); continue }
      const r = seconds / maxSeconds
      if (r < 0.2) rowData.push('l1')
      else if (r < 0.4) rowData.push('l2')
      else if (r < 0.6) rowData.push('l3')
      else if (r < 0.8) rowData.push('l4')
      else rowData.push('l5')
    }
    grid.push(rowData)
  }
  return grid
}

// GET /users/me/insights?period=week|month|all
export async function getInsights(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { period = 'month' } = request.query as { period?: string }
  const prisma = request.server.prisma

  const now = new Date()
  let startDate: Date

  if (period === 'week') {
    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7))
  } else if (period === 'all') {
    startDate = new Date(0)
  } else {
    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  }

  const sessions = await prisma.session.findMany({
    where: { userId, startedAt: { gte: startDate }, durationSeconds: { not: null } },
    include: { subject: { select: { name: true, colorHex: true } } },
    orderBy: { startedAt: 'asc' }
  })

  const totalSeconds = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0)
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

  const daysActive = Object.keys(dayMap).length
  const dailyAvgSeconds = daysActive > 0 ? Math.round(totalSeconds / daysActive) : 0
  const bestDaySeconds = Object.values(dayMap).sort((a, b) => b - a)[0] ?? 0
  const todayStr = now.toISOString().split('T')[0]

  // 7-day bar chart — pct relative to the busiest day in the window
  const rawBars: { day: string; date: string; seconds: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    const dateStr = d.toISOString().split('T')[0]
    rawBars.push({ day: d.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' }), date: dateStr, seconds: dayMap[dateStr] || 0 })
  }
  const maxBarSeconds = Math.max(...rawBars.map(b => b.seconds), 1)
  const barData = rawBars.map(b => ({
    day: b.day,
    pct: b.seconds / maxBarSeconds,
    active: b.date === todayStr,
    tooltip: b.seconds > 0 ? fmtSeconds(b.seconds) : null,
  }))

  const subjectDistribution = Object.entries(subjectMap)
    .map(([id, data]) => ({
      id,
      name: data.name,
      color: data.colorHex,
      pct: totalSeconds > 0 ? Math.round((data.seconds / totalSeconds) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)

  // Streak: consecutive days ending today
  let streak = 0
  let checkDate = todayStr
  while (dayMap[checkDate]) {
    streak++
    const d = new Date(checkDate + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - 1)
    checkDate = d.toISOString().split('T')[0]
  }

  return reply.send({ data: {
    totalTime: fmtSeconds(totalSeconds),
    dailyAvg:  fmtSeconds(dailyAvgSeconds),
    bestDay:   fmtSeconds(bestDaySeconds),
    heatmap:   buildHeatmapGrid(dayMap, now),
    barData,
    subjectDistribution,
    streak,
    totalSessions,
  }})
}
