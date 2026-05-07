import { completeSession } from '../../src/controllers/sessions.controller'

function makeReply() {
  const reply: any = {
    _status: 200,
    _data: null,
    status(code: number) { this._status = code; return this },
    send(data: any)     { this._data = data;   return this },
  }
  return reply
}

describe('completeSession — note field', () => {
  it('trims and saves note when provided in body', async () => {
    const existingSession = { id: 'ses-1', startedAt: new Date(Date.now() - 60_000) }
    const updatedSession  = {
      id: 'ses-1', durationSeconds: 60, endedAt: new Date(), note: 'test note',
    }
    const findUniqueMock = jest.fn().mockResolvedValue(existingSession)
    const updateMock     = jest.fn().mockResolvedValue(updatedSession)
    const findFirstMock  = jest.fn().mockResolvedValue(null)

    const req: any = {
      user:   { id: 'user-123' },
      params: { id: 'ses-1' },
      server: {
        prisma: {
          session:     { findUnique: findUniqueMock, update: updateMock },
          groupMember: { findFirst: findFirstMock },
        },
      },
      body: { durationSeconds: 60, note: '  test note  ' },
    }
    const reply = makeReply()

    await completeSession(req, reply)

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ses-1' },
        data: expect.objectContaining({ note: 'test note' }),
      })
    )
    expect(reply._data).toEqual({ data: { session: updatedSession } })
  })

  it('omits note from Prisma update when body has no note', async () => {
    const existingSession = { id: 'ses-2', startedAt: new Date(Date.now() - 60_000) }
    const updatedSession  = { id: 'ses-2', durationSeconds: 60, endedAt: new Date() }
    const findUniqueMock  = jest.fn().mockResolvedValue(existingSession)
    const updateMock      = jest.fn().mockResolvedValue(updatedSession)
    const findFirstMock   = jest.fn().mockResolvedValue(null)

    const req: any = {
      user:   { id: 'user-123' },
      params: { id: 'ses-2' },
      server: {
        prisma: {
          session:     { findUnique: findUniqueMock, update: updateMock },
          groupMember: { findFirst: findFirstMock },
        },
      },
      body: { durationSeconds: 60 },
    }
    const reply = makeReply()

    await completeSession(req, reply)

    const updateData = updateMock.mock.calls[0][0].data
    expect(updateData.note).toBeUndefined()
  })

  it('saves empty string when note is whitespace-only', async () => {
    const existingSession = { id: 'ses-3', startedAt: new Date(Date.now() - 60_000) }
    const updatedSession  = { id: 'ses-3', durationSeconds: 60, endedAt: new Date(), note: '' }
    const findUniqueMock  = jest.fn().mockResolvedValue(existingSession)
    const updateMock      = jest.fn().mockResolvedValue(updatedSession)
    const findFirstMock   = jest.fn().mockResolvedValue(null)

    const req: any = {
      user:   { id: 'user-123' },
      params: { id: 'ses-3' },
      server: {
        prisma: {
          session:     { findUnique: findUniqueMock, update: updateMock },
          groupMember: { findFirst: findFirstMock },
        },
      },
      body: { durationSeconds: 60, note: '   ' },
    }
    const reply = makeReply()

    await completeSession(req, reply)

    const updateData = updateMock.mock.calls[0][0].data
    expect(updateData.note).toBe('')
  })

  it('returns 404 when session does not exist', async () => {
    const findUniqueMock = jest.fn().mockResolvedValue(null)
    const updateMock     = jest.fn()

    const req: any = {
      user:   { id: 'user-123' },
      params: { id: 'missing-ses' },
      server: {
        prisma: {
          session:     { findUnique: findUniqueMock, update: updateMock },
          groupMember: { findFirst: jest.fn() },
        },
      },
      body: { durationSeconds: 60, note: 'hello' },
    }
    const reply = makeReply()

    await completeSession(req, reply)

    expect(reply._status).toBe(404)
    expect(reply._data).toEqual({ error: 'Session not found' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('computes duration from startedAt when durationSeconds is not provided', async () => {
    const startedAt       = new Date(Date.now() - 90_000)
    const existingSession = { id: 'ses-5', startedAt }
    const updatedSession  = { id: 'ses-5', durationSeconds: 90, endedAt: new Date() }
    const findUniqueMock  = jest.fn().mockResolvedValue(existingSession)
    const updateMock      = jest.fn().mockResolvedValue(updatedSession)
    const findFirstMock   = jest.fn().mockResolvedValue(null)

    const req: any = {
      user:   { id: 'user-123' },
      params: { id: 'ses-5' },
      server: {
        prisma: {
          session:     { findUnique: findUniqueMock, update: updateMock },
          groupMember: { findFirst: findFirstMock },
        },
      },
      body: {},
    }
    const reply = makeReply()

    await completeSession(req, reply)

    const savedDuration = updateMock.mock.calls[0][0].data.durationSeconds
    // allow ±2s for test execution time
    expect(savedDuration).toBeGreaterThanOrEqual(88)
    expect(savedDuration).toBeLessThanOrEqual(92)
  })
})
