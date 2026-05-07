import { getPreferences, updateUserPreferences } from '../../src/controllers/users.controller'

function makeReply() {
  const reply: any = {
    _status: 200,
    _data: null,
    status(code: number) { this._status = code; return this },
    send(data: any)   { this._data = data;   return this },
  }
  return reply
}

const FULL_PREFS_ROW = {
  id: 'pref-1',
  userId: 'user-123',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakAfterRounds: 4,
  autoStartBreaks: false,
  breakSound: 'soft_chime',
  dailyGoalSeconds: 3600,
  notificationsEnabled: true,
  studyReminders: true,
  reminderTime: '20:00',
  groupActivityAlerts: true,
  achievementAlerts: true,
  pomodoroSounds: true,
  theme: 'dark',
  compactMode: false,
  hideTimerDigits: false,
  motivationalQuotes: true,
  exitConfirmation: true,
  profilePublic: true,
  showInLeaderboard: true,
  shareStudyStats: true,
  shareAnalytics: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('getPreferences', () => {
  it('calls upsert with create:{userId} and update:{} then returns formatted prefs', async () => {
    const upsertMock = jest.fn().mockResolvedValue(FULL_PREFS_ROW)
    const req: any = {
      user: { id: 'user-123' },
      server: { prisma: { userPreferences: { upsert: upsertMock } } },
    }
    const reply = makeReply()

    await getPreferences(req, reply)

    expect(upsertMock).toHaveBeenCalledWith({
      where:  { userId: 'user-123' },
      create: { userId: 'user-123' },
      update: {},
    })

    const prefs = reply._data.data.preferences
    // Internal fields stripped
    expect(prefs.id).toBeUndefined()
    expect(prefs.userId).toBeUndefined()
    expect(prefs.createdAt).toBeUndefined()
    expect(prefs.updatedAt).toBeUndefined()
    // Rename applied
    expect(prefs.longBreakAfterRounds).toBeUndefined()
    expect(prefs.longBreakAfter).toBe(4)
    // Data fields present
    expect(prefs.focusMinutes).toBe(25)
    expect(prefs.theme).toBe('dark')
  })
})

describe('updateUserPreferences', () => {
  it('maps longBreakAfter → longBreakAfterRounds in upsert data', async () => {
    const updatedRow = { ...FULL_PREFS_ROW, focusMinutes: 30, longBreakAfterRounds: 3 }
    const upsertMock = jest.fn().mockResolvedValue(updatedRow)
    const req: any = {
      user: { id: 'user-123' },
      server: { prisma: { userPreferences: { upsert: upsertMock } } },
      body: { focusMinutes: 30, longBreakAfter: 3 },
    }
    const reply = makeReply()

    await updateUserPreferences(req, reply)

    const callArg = upsertMock.mock.calls[0][0]
    expect(callArg.update).toEqual({ focusMinutes: 30, longBreakAfterRounds: 3 })
    expect(callArg.update.longBreakAfter).toBeUndefined()
    expect(callArg.create).toEqual({ userId: 'user-123', focusMinutes: 30, longBreakAfterRounds: 3 })
    expect(reply._data.data.preferences.longBreakAfter).toBe(3)
    expect(reply._data.data.preferences.longBreakAfterRounds).toBeUndefined()
  })

  it('passes fields through unchanged when longBreakAfter is absent', async () => {
    const updatedRow = { ...FULL_PREFS_ROW, autoStartBreaks: true }
    const upsertMock = jest.fn().mockResolvedValue(updatedRow)
    const req: any = {
      user: { id: 'user-123' },
      server: { prisma: { userPreferences: { upsert: upsertMock } } },
      body: { autoStartBreaks: true },
    }
    const reply = makeReply()

    await updateUserPreferences(req, reply)

    expect(upsertMock.mock.calls[0][0].update).toEqual({ autoStartBreaks: true })
  })
})
