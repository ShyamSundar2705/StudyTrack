# StudyTrack Backend — Design Spec
_Date: 2026-04-28_

## Overview

A REST + WebSocket backend for StudyTrack, a study-session tracking app. Built with Fastify 5, Prisma 7, PostgreSQL, TypeScript, and Socket.io.

---

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js (CommonJS, `"type": "commonjs"`) |
| Language | TypeScript (`strict: false`) |
| HTTP framework | Fastify 5 |
| ORM | Prisma 7 with `prisma+postgres` local URL |
| Auth | JWT via `@fastify/jwt`, bearer token in `Authorization` header |
| Passwords | bcrypt |
| Real-time | Socket.io attached to Fastify HTTP server, namespace `/groups` |
| CORS | `@fastify/cors`, allow all origins (dev) |

---

## Environment Variables

```
DATABASE_URL   # Prisma+Postgres connection string
JWT_SECRET     # Secret for signing JWTs
PORT           # Server port (default 3000)
```

---

## Folder Structure

```
src/
├── routes/        # One file per resource, registers Fastify routes
├── controllers/   # Business logic, calls Prisma
├── middleware/    # Auth hook (verifyJWT), global error handler
├── plugins/       # prisma.ts (shared client), jwt.ts, cors.ts, socket.ts
└── types/         # Shared TypeScript interfaces (RequestUser, etc.)
server.ts          # Entry point — registers plugins, routes, starts server
```

---

## Data Models (Prisma)

```
User        id, email (unique), name, handle (unique), avatar, dailyGoalSeconds, createdAt
Subject     id, userId, name, colorHex, createdAt
Session     id, userId, subjectId, startedAt, endedAt, durationSeconds, type (FOCUS|POMODORO)
Task        id, userId, title, subjectId, dueDate, completed, completedAt, carriedOver
Achievement id, userId, type (enum), unlockedAt
Group       id, name, createdAt
GroupMember id, groupId, userId, joinedAt
```

- `Session.type` is a Prisma enum: `FOCUS`, `POMODORO`
- `Achievement.type` is a Prisma enum with predefined values (see below)

---

## REST Endpoints (all prefixed `/api`)

### Auth
```
POST /api/auth/register    body: { email, name, handle, password }
POST /api/auth/login       body: { email, password } → { data: { token, user } }
```

### Users
```
GET   /api/users/:id/profile
PATCH /api/users/:id/preferences   body: { name?, handle?, avatar?, dailyGoalSeconds? }
```

### Subjects
```
POST   /api/subjects         body: { userId, name, colorHex }
GET    /api/subjects?userId=X
DELETE /api/subjects/:id
```

### Sessions
```
POST  /api/sessions/start          body: { userId, subjectId, type }
PATCH /api/sessions/:id            body: partial session fields
POST  /api/sessions/:id/complete   body: { endedAt, durationSeconds }
GET   /api/sessions?userId=X&subjectId=Y
```

### Stats
```
GET /api/stats/heatmap?userId=X&month=YYYY-MM
  → { data: { [date: string]: number } }  (key = YYYY-MM-DD, value = total seconds)
```

### Tasks
```
GET   /api/tasks?userId=X&date=YYYY-MM-DD
POST  /api/tasks          body: { userId, title, subjectId?, dueDate? }
PATCH /api/tasks/:id      body: { completed?, completedAt?, carriedOver?, title?, dueDate? }
```

### Leaderboard
```
GET /api/leaderboard?scope=group&groupId=X
  → { data: [{ userId, name, handle, avatar, totalSeconds }] } (current week, desc)
```

### Achievements
```
GET /api/users/:id/achievements
```

---

## Response Shape

**Success:** `{ data: <payload> }`
**Error:** `{ error: string }` with appropriate HTTP status code

---

## Authentication

- All endpoints except `POST /api/auth/register` and `POST /api/auth/login` require a valid JWT
- JWT payload: `{ id, email }`
- Verified via a `preHandler` hook applied to protected routes
- Unauthorized requests receive `401 { error: "Unauthorized" }`

---

## Predefined Achievement Types

Reasonable defaults (can be extended later):
- `FIRST_SESSION` — completed first study session
- `STREAK_3` — 3-day study streak
- `STREAK_7` — 7-day study streak
- `TOTAL_1H` — accumulated 1 hour total
- `TOTAL_10H` — accumulated 10 hours total
- `TOTAL_100H` — accumulated 100 hours total
- `EARLY_BIRD` — started a session before 7 AM
- `NIGHT_OWL` — started a session after 10 PM

Achievement checks run inside `POST /api/sessions/:id/complete` — after completing a session the controller checks conditions and inserts new Achievement rows for any newly unlocked types.

---

## Socket.io

- Attached to the Fastify HTTP server, namespace `/groups`
- Events emitted by server:
  - `session:completed` — emitted to the group room when a member completes a session; payload: `{ userId, subjectId, durationSeconds }`
  - `leaderboard:updated` — emitted to the group room after `session:completed`; payload: updated leaderboard array
- Clients join a room by emitting `join:group` with `{ groupId }`

---

## Error Handling

- Global Fastify error handler in `src/middleware/errorHandler.ts`
- Returns `{ error: string }` — never exposes stack traces
- Prisma `P2025` (record not found) → 404
- Prisma `P2002` (unique constraint) → 409
- Validation errors → 400
- Unhandled → 500 with generic message

---

## Validation

- Fastify JSON Schema on all `POST` and `PATCH` request bodies
- Schemas defined inline in the route file alongside the handler registration
- Required fields enforced; optional fields marked with `?` in schema

---

## Build / Dev Scripts

```json
"scripts": {
  "dev": "ts-node src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev"
}
```

`ts-node` used for local dev; compiled output goes to `dist/`.
