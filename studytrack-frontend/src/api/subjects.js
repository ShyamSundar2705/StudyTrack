import client from './client';

// GET /subjects
// Returns: [{ id, name, color, totalSeconds }]
export const getSubjects = () =>
  client.get('/subjects').then((r) =>
    (r.data.data?.subjects ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      color: s.colorHex,
      totalSeconds: s.totalSeconds ?? 0,
    }))
  );

// GET /subjects/:id
// Returns normalised subject: { id, name, color, totalSeconds, dailyGoalSeconds, createdAt }
export const getSubjectDetails = (id) =>
  client.get(`/subjects/${id}`).then((r) => {
    const s = r.data.data?.subject ?? r.data;
    return {
      id:               s.id,
      name:             s.name,
      color:            s.colorHex ?? s.color,
      totalSeconds:     s.totalSeconds   ?? 0,
      dailyGoalSeconds: s.dailyGoalSeconds ?? 0,
      createdAt:        s.createdAt,
    };
  });

// POST /subjects
// Body: { name, color }
export const createSubject = (data) =>
  client.post('/subjects', data).then((r) => r.data);

// POST /subjects/bulk
// Body: { subjects: [{ name, color }] }
export const createBulkSubjects = (subjects) =>
  client.post('/subjects/bulk', { subjects }).then((r) => r.data);

// PUT /subjects/:id
// Body: { name?, color?, dailyGoalSeconds? }
export const updateSubject = (id, data) =>
  client.put(`/subjects/${id}`, data).then((r) => r.data);

// DELETE /subjects/:id
export const deleteSubject = (id) =>
  client.delete(`/subjects/${id}`).then((r) => r.data);
