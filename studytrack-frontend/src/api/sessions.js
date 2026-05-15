import client from './client';

// GET /sessions/today?date=YYYY-MM-DD
// Returns: [{ id, subjectId, subjectName, startedAt, elapsedSeconds }]
export const getTodaySessions = (date) =>
  client.get('/sessions/today', { params: date ? { date } : undefined }).then((r) => r.data.data?.sessions ?? []);

// POST /sessions/start
// Body: { subjectId, type }
// Returns: { data: { session: { id, ... } } }
export const startSession = (subjectId) =>
  client.post('/sessions/start', { subjectId, type: 'FOCUS' }).then((r) => r.data);

// POST /sessions/:id/complete
// Body: { durationSeconds, note? }
export const completeSession = (sessionId, durationSeconds, note) =>
  client.post(`/sessions/${sessionId}/complete`, {
    durationSeconds,
    ...(note ? { note } : {}),
  }).then((r) => r.data);

// POST /sessions/manual
// Body: { subjectId, startedAt, endedAt, note? }
// Returns: { data: { session, durationSeconds } }
export const manualSession = (data) =>
  client.post('/sessions/manual', data).then((r) => r.data.data ?? null);

// GET /sessions?subjectId=&from=&to=&period=
// Returns: { data: { sessions: [...] } }
export const getSessionHistory = (params) =>
  client.get('/sessions', { params }).then((r) => r.data);

// GET /sessions?subjectId=:id&period=week|month|all
export const getSessionsBySubject = (subjectId, params = {}) =>
  client.get('/sessions', { params: { subjectId, ...params } }).then((r) => r.data);
