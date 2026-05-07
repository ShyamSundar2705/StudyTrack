import { startSession } from '../../src/controllers/sessions.controller'

function makeReply() {
  const reply: any = {
    _status: 200,
    _data: null,
    status(code: number) { this._status = code; return this },
    send(data: any)   { this._data = data;   return this },
  }
  return reply
}

describe('startSession', () => {
  it('includes pomodoroRound in create data when provided', async () => {
    const fakeSession = {
      id: 'ses-1', userId: 'user-123', subjectId: 'sub-1',
      type: 'POMODORO', pomodoroRound: 2, startedAt: new Date(),
    }
    const createMock = jest.fn().mockResolvedValue(fakeSession)
    const req: any = {
      user:   { id: 'user-123' },
      server: { prisma: { session: { create: createMock } } },
      body:   { subjectId: 'sub-1', type: 'POMODORO', pomodoroRound: 2 },
    }
    const reply = makeReply()

    await startSession(req, reply)

    expect(createMock).toHaveBeenCalledWith({
      data: { userId: 'user-123', subjectId: 'sub-1', type: 'POMODORO', pomodoroRound: 2 },
    })
    expect(reply._status).toBe(201)
  })

  it('omits pomodoroRound from create data when not provided', async () => {
    const fakeSession = {
      id: 'ses-2', userId: 'user-123', subjectId: 'sub-1',
      type: 'FOCUS', startedAt: new Date(),
    }
    const createMock = jest.fn().mockResolvedValue(fakeSession)
    const req: any = {
      user:   { id: 'user-123' },
      server: { prisma: { session: { create: createMock } } },
      body:   { subjectId: 'sub-1', type: 'FOCUS' },
    }
    const reply = makeReply()

    await startSession(req, reply)

    const callData = createMock.mock.calls[0][0].data
    expect(callData.pomodoroRound).toBeUndefined()
    expect(callData.type).toBe('FOCUS')
  })
})
