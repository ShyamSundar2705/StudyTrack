import { getInsights } from '../../src/controllers/users.controller'

function makeReply() {
  const reply: any = { _data: null, send(data: any) { this._data = data; return this } }
  return reply
}

function makeReq(period: string, sessions: any[]) {
  const uniqueSubjects = [...new Map(
    sessions
      .filter(s => s.subject)
      .map(s => [s.subjectId, { id: s.subjectId, name: s.subject.name, colorHex: s.subject.colorHex }])
  ).values()]
  return {
    user: { id: 'user-1' },
    server: {
      prisma: {
        session: { findMany: jest.fn().mockResolvedValue(sessions) },
        subject: { findMany: jest.fn().mockResolvedValue(uniqueSubjects) },
      },
    },
    query: { period },
  } as any
}

function daysAgoUTC(n: number): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n))
}

function utcStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

const BASE_SESSION = {
  durationSeconds: 3600,
  subjectId: 's1',
  subject: { name: 'Math', colorHex: '#2D6BE4' },
}

describe('getInsights — new shape', () => {
  it('returns 7 heatmap + 7 dailyBreakdown entries for period=week', async () => {
    const sessions = [{ ...BASE_SESSION, startedAt: daysAgoUTC(2) }]
    const reply = makeReply()
    await getInsights(makeReq('week', sessions), reply)
    const data = reply._data.data
    expect(data.heatmap).toHaveLength(7)
    expect(data.dailyBreakdown).toHaveLength(7)
  })

  it('returns raw seconds for totalSeconds, dailyAverageSeconds, bestDaySeconds', async () => {
    const sessions = [{ ...BASE_SESSION, startedAt: daysAgoUTC(1) }]
    const reply = makeReply()
    await getInsights(makeReq('week', sessions), reply)
    const data = reply._data.data
    expect(data.totalSeconds).toBe(3600)
    expect(data.dailyAverageSeconds).toBe(3600)
    expect(data.bestDaySeconds).toBe(3600)
  })

  it('places session seconds on the correct date in heatmap', async () => {
    const sessions = [{ ...BASE_SESSION, durationSeconds: 7200, startedAt: daysAgoUTC(2) }]
    const reply = makeReply()
    await getInsights(makeReq('week', sessions), reply)
    const dateStr = utcStr(daysAgoUTC(2))
    const entry = reply._data.data.heatmap.find((e: any) => e.date === dateStr)
    expect(entry.seconds).toBe(7200)
  })

  it('returns 30 heatmap + 30 dailyBreakdown entries for period=month', async () => {
    const reply = makeReply()
    await getInsights(makeReq('month', []), reply)
    const data = reply._data.data
    expect(data.heatmap).toHaveLength(30)
    expect(data.dailyBreakdown).toHaveLength(30)
  })

  it('returns 365 heatmap + 12 dailyBreakdown entries for period=allTime', async () => {
    const reply = makeReply()
    await getInsights(makeReq('allTime', []), reply)
    const data = reply._data.data
    expect(data.heatmap).toHaveLength(365)
    expect(data.dailyBreakdown).toHaveLength(12)
  })

  it('accepts "all" as an alias for allTime', async () => {
    const reply = makeReply()
    await getInsights(makeReq('all', []), reply)
    expect(reply._data.data.heatmap).toHaveLength(365)
    expect(reply._data.data.dailyBreakdown).toHaveLength(12)
  })

  it('returns zeros when no sessions', async () => {
    const reply = makeReply()
    await getInsights(makeReq('week', []), reply)
    const data = reply._data.data
    expect(data.totalSeconds).toBe(0)
    expect(data.dailyAverageSeconds).toBe(0)
    expect(data.bestDaySeconds).toBe(0)
    expect(data.streak).toBe(0)
    expect(data.totalSessions).toBe(0)
    expect(data.bySubject).toEqual([])
  })

  it('returns bySubject sorted by seconds desc with percentage', async () => {
    const sessions = [
      { durationSeconds: 3600, startedAt: daysAgoUTC(1), subjectId: 's1', subject: { name: 'Math', colorHex: '#2D6BE4' } },
      { durationSeconds: 7200, startedAt: daysAgoUTC(1), subjectId: 's2', subject: { name: 'Physics', colorHex: '#A855F7' } },
    ]
    const reply = makeReply()
    await getInsights(makeReq('week', sessions), reply)
    const { bySubject } = reply._data.data
    expect(bySubject[0].subjectId).toBe('s2')
    expect(bySubject[0].seconds).toBe(7200)
    expect(bySubject[0].percentage).toBe(67)
    expect(bySubject[1].subjectId).toBe('s1')
    expect(bySubject[1].percentage).toBe(33)
    expect(bySubject[0].name).toBe('Physics')
    expect(bySubject[0].colorHex).toBe('#A855F7')
  })

  it('allTime dailyBreakdown entries have date = YYYY-MM-01', async () => {
    const reply = makeReply()
    await getInsights(makeReq('allTime', []), reply)
    const { dailyBreakdown } = reply._data.data
    dailyBreakdown.forEach((entry: any) => {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-01$/)
    })
  })

  it('response has no totalTime, dailyAvg, bestDay, barData, subjectDistribution fields', async () => {
    const reply = makeReply()
    await getInsights(makeReq('week', []), reply)
    const data = reply._data.data
    expect(data.totalTime).toBeUndefined()
    expect(data.dailyAvg).toBeUndefined()
    expect(data.bestDay).toBeUndefined()
    expect(data.barData).toBeUndefined()
    expect(data.subjectDistribution).toBeUndefined()
  })
})
