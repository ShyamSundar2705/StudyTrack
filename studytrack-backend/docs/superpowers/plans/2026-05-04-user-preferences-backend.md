# User Preferences Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `UserPreferences` model, `pomodoroRound` on `Session`, and `GET/PATCH /api/users/me/preferences` endpoints to the StudyTrack backend.

**Architecture:** `UserPreferences` is a 1:1 extension of `User` created on demand via upsert — no eager creation in auth. Both endpoints use Option-A upsert (GET creates with all defaults on first call; PATCH creates + updates atomically). A `formatPrefs` helper strips internal fields and renames `longBreakAfterRounds → longBreakAfter` for every response.

**Tech Stack:** Fastify v5, Prisma v7 (`@prisma/adapter-pg`), TypeScript, ts-jest

---

## File Map

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `UserPreferences` model; add `preferences UserPreferences?` to `User`; add `pomodoroRound Int?` to `Session` |
| `src/controllers/users.controller.ts` | Add `formatPrefs` helper, `getPreferences` handler, `updateUserPreferences` handler |
| `src/routes/users.ts` | Import new handlers; register `GET /users/me/preferences` and `PATCH /users/me/preferences` |
| `src/controllers/sessions.controller.ts` | Destructure `pomodoroRound` from body; pass to `prisma.session.create` when present |
| `src/routes/sessions.ts` | Add `pomodoroRound: { type: 'integer', minimum: 1 }` to `POST /sessions/start` body schema |
| `__tests__/controllers/users-preferences.test.ts` | Unit tests for `formatPrefs`, `getPreferences`, `updateUserPreferences` |
| `__tests__/controllers/sessions-pomodoro.test.ts` | Unit tests for `startSession` with/without `pomodoroRound` |
| `CLAUDE.md` | Update schema table, API table, What Was Built |

---

## Task 1: Schema Changes

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace `prisma/schema.prisma` with the updated schema**

The full file content — every model is shown. The only changes vs the current file are: `preferences UserPreferences?` added to `User`; `pomodoroRound Int?` added to `Session`; entire `UserPreferences` model added at the bottom.

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum SessionType {
  FOCUS
  POMODORO
}

enum AchievementType {
  FIRST_SESSION
  STREAK_3
  STREAK_7
  TOTAL_1H
  TOTAL_10H
  TOTAL_100H
  EARLY_BIRD
  NIGHT_OWL
}

model User {
  id               String           @id @default(cuid())
  supabaseUid      String?          @unique
  email            String           @unique
  name             String
  handle           String           @unique
  avatar           String?
  passwordHash     String?
  dailyGoalSeconds Int              @default(3600)
  createdAt        DateTime         @default(now())
  lastLoginAt      DateTime?
  subjects         Subject[]
  sessions         Session[]
  tasks            Task[]
  achievements     Achievement[]
  groupMembers     GroupMember[]
  preferences      UserPreferences?
}

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

model Subject {
  id        String    @id @default(cuid())
  userId    String
  name      String
  colorHex  String
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id])
  sessions  Session[]
  tasks     Task[]
}

model Session {
  id              String      @id @default(cuid())
  userId          String
  subjectId       String
  startedAt       DateTime    @default(now())
  endedAt         DateTime?
  durationSeconds Int?
  pomodoroRound   Int?
  type            SessionType
  user            User        @relation(fields: [userId], references: [id])
  subject         Subject     @relation(fields: [subjectId], references: [id])
}

model Task {
  id          String    @id @default(cuid())
  userId      String
  title       String
  subjectId   String?
  dueDate     DateTime?
  completed   Boolean   @default(false)
  completedAt DateTime?
  carriedOver Boolean   @default(false)
  user        User      @relation(fields: [userId], references: [id])
  subject     Subject?  @relation(fields: [subjectId], references: [id])
}

model Achievement {
  id         String          @id @default(cuid())
  userId     String
  type       AchievementType
  unlockedAt DateTime        @default(now())
  user       User            @relation(fields: [userId], references: [id])
}

model Group {
  id        String        @id @default(cuid())
  name      String
  createdAt DateTime      @default(now())
  members   GroupMember[]
}

model GroupMember {
  id       String   @id @default(cuid())
  groupId  String
  userId   String
  joinedAt DateTime @default(now())
  group    Group    @relation(fields: [groupId], references: [id])
  user     User     @relation(fields: [userId], references: [id])
}
```

- [ ] **Step 2: Push schema to the database**

`npx prisma dev` must be running in a separate terminal before this step.

```bash
npx prisma db push
```

Expected output includes:
```
Your database is now in sync with your Prisma schema.
```

- [ ] **Step 3: Regenerate the Prisma client**

```bash
npx prisma generate
```

Expected output includes:
```
✔ Generated Prisma Client
```

- [ ] **Step 4: Verify the server still starts cleanly**

```bash
npm run dev
```

Expected: server starts on port 3000 with no TypeScript errors. Stop it with Ctrl+C.

---

## Task 2: `getPreferences` controller + tests

**Files:**
- Modify: `src/controllers/users.controller.ts`
- Create: `__tests__/controllers/users-preferences.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/controllers/users-preferences.test.ts`:

```typescript
import { getPreferences } from '../../src/controllers/users.controller'

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
  dailyGoalSeconds: 21600,
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest __tests__/controllers/users-preferences.test.ts --no-coverage
```

Expected: FAIL — `getPreferences is not a function` (or similar export error).

- [ ] **Step 3: Add `formatPrefs` helper and `getPreferences` to `src/controllers/users.controller.ts`**

Add these two blocks immediately before the existing `getProfile` function (after the `USER_SELECT` const):

```typescript
function formatPrefs(prefs: any) {
  const { id, userId, createdAt, updatedAt, longBreakAfterRounds, ...rest } = prefs
  return { ...rest, longBreakAfter: longBreakAfterRounds }
}

export async function getPreferences(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const prisma = request.server.prisma

  const prefs = await prisma.userPreferences.upsert({
    where:  { userId },
    create: { userId },
    update: {},
  })

  return reply.send({ data: { preferences: formatPrefs(prefs) } })
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest __tests__/controllers/users-preferences.test.ts --no-coverage
```

Expected: PASS — 1 test suite, 1 test.

---

## Task 3: `updateUserPreferences` controller + tests

**Files:**
- Modify: `src/controllers/users.controller.ts`
- Modify: `__tests__/controllers/users-preferences.test.ts`

- [ ] **Step 1: Add failing tests to `__tests__/controllers/users-preferences.test.ts`**

First, update the import line at the top of the file from:
```typescript
import { getPreferences } from '../../src/controllers/users.controller'
```
to:
```typescript
import { getPreferences, updateUserPreferences } from '../../src/controllers/users.controller'
```

Then append below the existing `describe('getPreferences', ...)` block:

```typescript
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
    // longBreakAfter must be renamed; original key must be gone
    expect(callArg.update).toEqual({ focusMinutes: 30, longBreakAfterRounds: 3 })
    expect(callArg.update.longBreakAfter).toBeUndefined()
    expect(callArg.create).toEqual({ userId: 'user-123', focusMinutes: 30, longBreakAfterRounds: 3 })
    // Response uses API key
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
```

- [ ] **Step 2: Run tests to confirm the new ones fail**

```bash
npx jest __tests__/controllers/users-preferences.test.ts --no-coverage
```

Expected: 1 pass (getPreferences), 2 fail (updateUserPreferences not exported yet).

- [ ] **Step 3: Add `updateUserPreferences` to `src/controllers/users.controller.ts`**

Add immediately after the `getPreferences` function:

```typescript
export async function updateUserPreferences(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const prisma = request.server.prisma
  const data: Record<string, any> = { ...(request.body as Record<string, any>) }

  if ('longBreakAfter' in data) {
    data.longBreakAfterRounds = data.longBreakAfter
    delete data.longBreakAfter
  }

  const prefs = await prisma.userPreferences.upsert({
    where:  { userId },
    create: { userId, ...data },
    update: data,
  })

  return reply.send({ data: { preferences: formatPrefs(prefs) } })
}
```

- [ ] **Step 4: Run all preference tests to confirm they pass**

```bash
npx jest __tests__/controllers/users-preferences.test.ts --no-coverage
```

Expected: PASS — 1 test suite, 3 tests.

---

## Task 4: Register preference routes

**Files:**
- Modify: `src/routes/users.ts`

- [ ] **Step 1: Update `src/routes/users.ts`**

Replace the entire file with:

```typescript
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
      name:             { type: 'string', minLength: 1 },
      handle:           { type: 'string', minLength: 1 },
      avatar:           { type: 'string' },
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
  // /me convenience routes — must be registered before /:id routes
  fastify.get('/users/me',              { preHandler: authenticate }, getMe)
  fastify.patch('/users/me',            { preHandler: authenticate, schema: ME_UPDATE_SCHEMA }, updateMe)
  fastify.get('/users/me/stats',        { preHandler: authenticate }, getStats)
  fastify.get('/users/me/group',        { preHandler: authenticate }, getMyGroup)
  fastify.get('/users/me/insights',     { preHandler: authenticate }, getInsights)
  fastify.get('/users/me/preferences',  { preHandler: authenticate }, getPreferences)
  fastify.patch('/users/me/preferences',{ preHandler: authenticate, schema: USER_PREFS_SCHEMA }, updateUserPreferences)

  // Legacy /:id routes
  fastify.get('/users/:id/profile',         { preHandler: authenticate }, getProfile)
  fastify.patch('/users/:id/preferences',   { preHandler: authenticate, schema: ME_UPDATE_SCHEMA }, updatePreferences)
}
```

- [ ] **Step 2: Confirm the server compiles with no TypeScript errors**

```bash
npm run dev
```

Expected: server starts cleanly. Stop with Ctrl+C.

- [ ] **Step 3: Smoke-test the GET endpoint manually**

With the server running and a valid JWT from a previous login, run:

```bash
curl -s -H "Authorization: Bearer <your_jwt>" http://localhost:3000/api/users/me/preferences | npx json
```

Expected: `{ "data": { "preferences": { "focusMinutes": 25, "longBreakAfter": 4, ... } } }`

---

## Task 5: `pomodoroRound` on Session

**Files:**
- Modify: `src/routes/sessions.ts`
- Modify: `src/controllers/sessions.controller.ts`
- Create: `__tests__/controllers/sessions-pomodoro.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/controllers/sessions-pomodoro.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/controllers/sessions-pomodoro.test.ts --no-coverage
```

Expected: FAIL — the current `startSession` does not pass `pomodoroRound`.

- [ ] **Step 3: Update `src/controllers/sessions.controller.ts` — `startSession` function only**

Replace the `startSession` function (lines 3–11) with:

```typescript
export async function startSession(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { subjectId, type, pomodoroRound } = request.body as {
    subjectId: string
    type: 'FOCUS' | 'POMODORO'
    pomodoroRound?: number
  }

  const prisma = request.server.prisma
  const data: Record<string, any> = { userId, subjectId, type }
  if (pomodoroRound !== undefined) data.pomodoroRound = pomodoroRound

  const session = await prisma.session.create({ data })
  return reply.status(201).send({ data: { session } })
}
```

- [ ] **Step 4: Update `src/routes/sessions.ts` — `POST /sessions/start` schema only**

Replace the body schema block inside the `fastify.post('/sessions/start', ...)` call:

```typescript
schema: {
  body: {
    type: 'object',
    required: ['subjectId', 'type'],
    properties: {
      subjectId:     { type: 'string' },
      type:          { type: 'string', enum: ['FOCUS', 'POMODORO'] },
      pomodoroRound: { type: 'integer', minimum: 1 },
    }
  }
}
```

- [ ] **Step 5: Run session tests to confirm they pass**

```bash
npx jest __tests__/controllers/sessions-pomodoro.test.ts --no-coverage
```

Expected: PASS — 1 test suite, 2 tests.

- [ ] **Step 6: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all test suites pass.

---

## Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add `UserPreferences` to the Schema models table**

In the `### Schema models` table, add a new row after the `User` row:

```
| `UserPreferences` | `id`, `userId` (unique), full prefs fields | 1:1 with `User`; created on first GET or PATCH `/users/me/preferences`; `onDelete: Cascade`; Pomodoro, notifications, appearance, privacy, analytics fields |
```

- [ ] **Step 2: Add `pomodoroRound` note to Session model row**

In the Session row of the Schema models table, update the Key fields column to include `pomodoroRound?` and add a note:

```
| `Session` | `id`, `userId`, `subjectId`, `startedAt`, `endedAt?`, `durationSeconds?`, `pomodoroRound?`, `type` (FOCUS \| POMODORO) | `pomodoroRound` is set only for POMODORO sessions; tracks which focus round (1, 2, 3…) |
```

- [ ] **Step 3: Add preference endpoints to the Users API table**

In `### Users — auth required`, add two rows:

```
| `GET`   | `/api/users/me/preferences` | Fetch caller's full preferences; upserts with defaults on first call |
| `PATCH` | `/api/users/me/preferences` | Update any subset of preference fields; body key `longBreakAfter` maps to `longBreakAfterRounds` in DB |
```

- [ ] **Step 4: Update `pomodoroRound` in the Sessions API table**

In `### Sessions — auth required`, update the `POST /sessions/start` row description:

```
| `POST` | `/api/sessions/start` | Create a new session (`subjectId`, `type: FOCUS\|POMODORO`, optional `pomodoroRound`); userId from JWT |
```

- [ ] **Step 5: Add to What Was Built section**

Append to the `## What Was Built — Session History` list:

```
- **Pomodoro backend:** `UserPreferences` model (Pomodoro config, notifications, appearance, privacy, analytics fields); `GET /api/users/me/preferences` and `PATCH /api/users/me/preferences` (Option-A upsert, `longBreakAfter ↔ longBreakAfterRounds` mapping); `pomodoroRound Int?` added to `Session`; `POST /sessions/start` now accepts and persists `pomodoroRound`
```
