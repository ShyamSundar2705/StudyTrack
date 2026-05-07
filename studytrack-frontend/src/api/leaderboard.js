import client from './client';

// GET /leaderboard?scope=group|category|global&period=today|week|month|all
// Returns: { podium: [{ pos, name, time, borderColor, barH, isGold }],
//            ranked: [{ pos, name, time, trend, trendLabel, isMe }] }
export const getLeaderboard = (scope = 'group', period = 'week') =>
  client.get('/leaderboard', { params: { scope, period } }).then((r) => r.data);

// GET /groups/:id/leaderboard?period=today|week|month
// Returns: [{ rank, userId, name, handle, avatarInitial, durationSeconds, subjectName, subjectColor, rankChange }]
export const getGroupLeaderboard = (groupId, period = 'today') =>
  client.get(`/groups/${groupId}/leaderboard`, { params: { period } })
    .then((r) => r.data?.data?.leaderboard ?? []);
