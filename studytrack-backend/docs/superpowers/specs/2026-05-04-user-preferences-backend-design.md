# User Preferences Backend — Design Spec

**Date:** 2026-05-04  
**Scope:** Add `UserPreferences` model, generic `/api/users/me/preferences` CRUD endpoints, and `pomodoroRound` tracking on Session.

---

## Background

The Pomodoro frontend (Parts 6–14) is fully implemented. The backend never received its counterpart changes. This spec covers exactly the missing backend work: a preferences persistence layer and the `pomodoroRound` Session field.

---

## Schema Changes (`prisma/schema.prisma`)

### New model: `UserPreferences`

```prisma
model UserPreferences {
  id                   String   @id @default(cuid())
  userId               String   @unique
  user                 User     @relation(
                         fields: [userId],
                         references: [id],
                         onDelete: Cascade
                       )

  // Pomodoro
  focusMinutes         Int      @default(25)
  shortBreakMinutes    Int      @default(5)
  longBreakMinutes     Int      @default(15)
  longBreakAfterRounds Int      @default(4)
  autoStartBreaks      Boolean  @default(false)
  breakSound           String   @default("soft_chime")

  // Daily goal
  dailyGoalSeconds     Int      @default(21600)

  // Notifications
  notificationsEnabled Boolean  @default(true)
  studyReminders       Boolean  @default(true)
  reminderTime         String   @default("20:00")
  groupActivityAlerts  Boolean  @default(true)
  achievementAlerts    Boolean  @default(true)
  pomodoroSounds       Boolean  @default(true)

  // Appearance
  theme                String   @default("dark")
  compactMode          Boolean  @default(false)
  hideTimerDigits      Boolean  @default(false)
  motivationalQuotes   Boolean  @default(true)
  exitConfirmation     Boolean  @default(true)

  // Privacy
  profilePublic        Boolean  @default(true)
  showInLeaderboard    Boolean  @default(true)
  shareStudyStats      Boolean  @default(true)

  // Analytics
  shareAnalytics       Boolean  @default(true)

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

### `User` model — add back-relation

```prisma
preferences  UserPreferences?
```

### `Session` model — add optional field

```prisma
pomodoroRound  Int?
```

After edits: run `npx prisma db push` then `npx prisma generate`.

---

## API Endpoints

Both routes sit under `/api/users/me` and require a valid JWT (`authenticate` preHandler). They replace the previously planned `/api/users/me/pomodoro-config` endpoints — there are no pomodoro-config routes.

### `GET /api/users/me/preferences`

**Handler:** `getPreferences`  
**Pattern:** upsert with all defaults (Option A) — always returns a full object, no 404 possible.

**Response:**
```json
{
  "data": {
    "preferences": {
      "focusMinutes": 25,
      "shortBreakMinutes": 5,
      "longBreakMinutes": 15,
      "longBreakAfter": 4,
      "autoStartBreaks": false,
      "breakSound": "soft_chime",
      "dailyGoalSeconds": 21600,
      "notificationsEnabled": true,
      "studyReminders": true,
      "reminderTime": "20:00",
      "groupActivityAlerts": true,
      "achievementAlerts": true,
      "pomodoroSounds": true,
      "theme": "dark",
      "compactMode": false,
      "hideTimerDigits": false,
      "motivationalQuotes": true,
      "exitConfirmation": true,
      "profilePublic": true,
      "showInLeaderboard": true,
      "shareStudyStats": true,
      "shareAnalytics": true
    }
  }
}
```

Note: Prisma field `longBreakAfterRounds` is returned as `longBreakAfter` in the response to match the frontend `usePomodoroStore` key.

### `PATCH /api/users/me/preferences`

**Handler:** `updatePreferences` *(rename existing `updatePreferences` to `updateMe` — or add new handler; see Files Touched)*  
**Pattern:** accepts any subset of all preference fields, upserts, returns same full shape as GET.

**Body schema** (all fields optional):
```json
{
  "focusMinutes": "integer",
  "shortBreakMinutes": "integer",
  "longBreakMinutes": "integer",
  "longBreakAfter": "integer",
  "autoStartBreaks": "boolean",
  "breakSound": "string",
  "dailyGoalSeconds": "integer",
  "notificationsEnabled": "boolean",
  "studyReminders": "boolean",
  "reminderTime": "string",
  "groupActivityAlerts": "boolean",
  "achievementAlerts": "boolean",
  "pomodoroSounds": "boolean",
  "theme": "string",
  "compactMode": "boolean",
  "hideTimerDigits": "boolean",
  "motivationalQuotes": "boolean",
  "exitConfirmation": "boolean",
  "profilePublic": "boolean",
  "showInLeaderboard": "boolean",
  "shareStudyStats": "boolean",
  "shareAnalytics": "boolean"
}
```

**Mapping:** `longBreakAfter` in the request body → `longBreakAfterRounds` in the Prisma update call.

---

## Sessions Change

`POST /sessions/start` schema (`src/routes/sessions.ts`) gets `pomodoroRound` added as an optional integer property. The `startSession` controller (`src/controllers/sessions.controller.ts`) passes it to `prisma.session.create` when present in the request body.

---

## Files Touched

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `UserPreferences` model; add `preferences UserPreferences?` to `User`; add `pomodoroRound Int?` to `Session` |
| `src/controllers/users.controller.ts` | Add `getPreferences`, `updateUserPreferences` handlers; note: existing `updatePreferences` (legacy `/:id` handler) is kept as-is |
| `src/routes/users.ts` | Add `GET /users/me/preferences` and `PATCH /users/me/preferences` registrations; import new handlers |
| `src/routes/sessions.ts` | Add `pomodoroRound: { type: 'integer' }` to `POST /sessions/start` body schema |
| `src/controllers/sessions.controller.ts` | Pass `pomodoroRound` from body to `prisma.session.create` |
| `CLAUDE.md` | Update schema table, API endpoint table, and What Was Built section |

No new files. No auth, socket, or other domain changes.

---

## Handler Implementation Notes

### `getPreferences`

```
userId = request.user.id
prefs = await prisma.userPreferences.upsert({
  where: { userId },
  create: { userId },   // all defaults from schema
  update: {},           // no-op if exists
})
return { data: { preferences: formatPrefs(prefs) } }
```

### `updateUserPreferences`

```
userId = request.user.id
body = request.body  // validated by Fastify schema
// rename longBreakAfter → longBreakAfterRounds if present
data = { ...body }
if ('longBreakAfter' in data) {
  data.longBreakAfterRounds = data.longBreakAfter
  delete data.longBreakAfter
}
prefs = await prisma.userPreferences.upsert({
  where: { userId },
  create: { userId, ...data },
  update: data,
})
return { data: { preferences: formatPrefs(prefs) } }
```

`formatPrefs` strips `id`, `userId`, `createdAt`, `updatedAt`, and renames `longBreakAfterRounds → longBreakAfter` for the response.

---

## What Is NOT Changed

- Auth flow — no `UserPreferences` row created on register/login
- Socket.io — no changes
- Legacy `GET/PATCH /users/:id/preferences` routes — kept for backwards compatibility
- `UserPreferences` is never auto-created; it is created on first GET or PATCH of `/users/me/preferences`
