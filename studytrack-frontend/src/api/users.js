import client from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_KEY } from './client';

// GET /users/me
// Returns: { id, name, handle, avatar, streak, totalHours, dailyGoalSeconds }
export const getMe = () =>
  client.get('/users/me').then((r) => r.data.data?.user ?? null);

// PUT /users/me
// Body: { name?, handle?, avatar?, dailyGoalSeconds? }
export const updateMe = (data) =>
  client.put('/users/me', data).then((r) => r.data);

// GET /users/me/insights?period=week|month|allTime&subjectId= (subjectId optional)
// Returns: { totalSeconds, dailyAverageSeconds, bestDaySeconds, heatmap, bySubject, dailyBreakdown, streak, totalSessions }
export const getInsights = (period, subjectId) =>
  client.get('/users/me/insights', { params: { period, ...(subjectId && { subjectId }) } }).then((r) => r.data.data ?? null);

// GET /users/me/stats
// Returns: lifetime stats: { totalHours, totalSessions, totalSubjects, daysActive }
export const getStats = () =>
  client.get('/users/me/stats').then((r) => r.data.data?.stats ?? null);

// GET /users/me/group
// Returns: { id, name, members: [...], activity: [...], topContributors: [...] }
export const getMyGroup = () =>
  client.get('/users/me/group').then((r) => r.data);

// GET /users/me/preferences
// Backend upserts with defaults on first call — no 404 possible.
// Returns the full preferences object, or null on network error.
export const getPreferences = () =>
  client.get('/users/me/preferences').then((r) => r.data.data?.preferences ?? null);

// PATCH /users/me/preferences
// patch: any subset of preference fields.
// Returns updated full preferences object, or null on network error.
export const updatePreferences = (patch) =>
  client.patch('/users/me/preferences', patch).then((r) => r.data.data?.preferences ?? null);

// POST /auth/google — exchange Google ID token for app JWT
// Body: { idToken }
// Returns: { token, user }
export const signInWithGoogle = async (idToken) => {
  const { data } = await client.post('/auth/google', { idToken });
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  return data;
};

// POST /auth/email
// Body: { email, password }
// Returns: { token, user }
export const signInWithEmail = async (email, password) => {
  const { data } = await client.post('/auth/email', { email, password });
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  return data;
};

// POST /auth/logout
export const signOut = async () => {
  await client.post('/auth/logout').catch(() => {});
  await AsyncStorage.removeItem(TOKEN_KEY);
};
