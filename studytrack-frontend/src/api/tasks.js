import client from './client';

// GET /tasks?date=YYYY-MM-DD
// Returns array of task objects: [{ id, title, completed, dueDate, subjectId, carriedOver }]
export const getTasks = (date) =>
  client.get('/tasks', { params: { date } }).then((r) => r.data.data?.tasks ?? []);

// POST /tasks
// Body: { title, dueDate?, subjectId? }
export const createTask = (data) =>
  client.post('/tasks', data).then((r) => r.data.data?.task ?? null);

// PATCH /tasks/:id
// Body: { title?, completed?, dueDate? }
export const updateTask = (id, data) =>
  client.patch(`/tasks/${id}`, data).then((r) => r.data.data?.task ?? null);

// DELETE /tasks/:id
export const deleteTask = (id) =>
  client.delete(`/tasks/${id}`).then((r) => r.data);
