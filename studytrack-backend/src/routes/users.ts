import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import {
  getProfile,
  updatePreferences,
  getMe,
  updateMe,
  getStats,
  getMyGroup,
  getInsights,
  getPreferences,
  updateUserPreferences,
} from '../controllers/users.controller'

const ME_UPDATE_SCHEMA = {
  body: {
    type: 'object',
    properties: {
      name:             { type: 'string', minLength: 1, maxLength: 50 },
      handle:           { type: 'string', minLength: 1, maxLength: 30 },
      avatarColor:      { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
      dailyGoalSeconds: { type: 'integer', minimum: 0 },
    }
  }
}

const USER_PREFS_SCHEMA = {
  body: {
    type: 'object',
    properties: {
      focusMinutes:         { type: 'integer', minimum: 1 },
      shortBreakMinutes:    { type: 'integer', minimum: 1 },
      longBreakMinutes:     { type: 'integer', minimum: 1 },
      longBreakAfter:       { type: 'integer', minimum: 1 },
      autoStartBreaks:      { type: 'boolean' },
      breakSound:           { type: 'string' },
      dailyGoalSeconds:     { type: 'integer', minimum: 0 },
      notificationsEnabled: { type: 'boolean' },
      studyReminders:       { type: 'boolean' },
      reminderTime:         { type: 'string' },
      groupActivityAlerts:  { type: 'boolean' },
      achievementAlerts:    { type: 'boolean' },
      pomodoroSounds:       { type: 'boolean' },
      theme:                { type: 'string' },
      accentColor:          { type: 'string', enum: ['blue', 'purple', 'green', 'orange', 'teal'] },
      compactMode:          { type: 'boolean' },
      hideTimerDigits:      { type: 'boolean' },
      motivationalQuotes:   { type: 'boolean' },
      exitConfirmation:     { type: 'boolean' },
      profilePublic:        { type: 'boolean' },
      showInLeaderboard:    { type: 'boolean' },
      shareStudyStats:      { type: 'boolean' },
      shareAnalytics:       { type: 'boolean' },
    }
  }
}

export default async function userRoutes(fastify: FastifyInstance) {
  // /me routes — must be registered before /:id routes
  fastify.get('/users/me',               { preHandler: authenticate }, getMe)
  fastify.patch('/users/me',             { preHandler: authenticate, schema: ME_UPDATE_SCHEMA }, updateMe)
  fastify.get('/users/me/stats',         { preHandler: authenticate }, getStats)
  fastify.get('/users/me/group',         { preHandler: authenticate }, getMyGroup)
  fastify.get('/users/me/insights',      { preHandler: authenticate }, getInsights)
  fastify.get('/users/me/preferences',   { preHandler: authenticate }, getPreferences)
  fastify.patch('/users/me/preferences', { preHandler: authenticate, schema: USER_PREFS_SCHEMA }, updateUserPreferences)

  // Legacy /:id routes
  fastify.get('/users/:id/profile',        { preHandler: authenticate }, getProfile)
  fastify.patch('/users/:id/preferences',  { preHandler: authenticate, schema: ME_UPDATE_SCHEMA }, updatePreferences)
}
