# StudyTrack — Backend

## Project Overview

REST API and WebSocket server for the StudyTrack mobile app. Handles user auth (Supabase token exchange + email/password), study session logging, subject management, task planning, leaderboards, achievements, and real-time group presence via Socket.io.

- **Runtime:** Node.js with `ts-node --transpile-only` for development
- **Language:** TypeScript (strict mode off)
- **Framework:** Fastify v5
- **Database:** PostgreSQL via Prisma ORM with direct `postgres://` TCP connection via `@prisma/adapter-pg`

## Folder Structure

```
server.ts          — entry point
prisma/schema.prisma — single source of truth for models
generated/prisma/client/ — auto-generated, never edit
src/
  plugins/   — prisma.ts (decorates fastify.prisma), socket.ts (decorates fastify.io)
  middleware/ — auth.ts (jwtVerify preHandler), errorHandler.ts
  routes/    — one file per resource (auth, users, subjects, sessions, tasks, scheduleEvents, groups, leaderboard, stats, achievements)
  controllers/ — one file per resource
  socket/    — groups.socket.ts (registerGroupSocketHandlers)
```

## Database

### ORM & connection

- **ORM:** Prisma v7
- **Connection:** Direct `postgres://` TCP URL (from `npx prisma dev` default ports). `PrismaClient` is instantiated with `@prisma/adapter-pg`: `new PrismaPg(DATABASE_URL)` → `new PrismaClient({ adapter })`. See `src/plugins/prisma.ts`. The `prisma+postgres://` HTTP proxy URL is **not supported** with Prisma Client 7.8.0 + current `prisma dev` version.
- **Client output:** `generated/prisma/client` (set in `generator client` block)

### Schema models

| Model | Key fields | Notes |
|---|---|---|
| `User` | `id` (cuid), `supabaseUid` (unique), `email` (unique), `name`, `handle` (unique), `avatar?`, `avatarColor String?`, `passwordHash?`, `dailyGoalSeconds` (default 3600) | `supabaseUid` is null for email-registered users |
| `UserPreferences` | `id`, `userId` (unique), full prefs fields | 1:1 with `User`; created lazily on first `GET` or `PATCH /users/me/preferences`; `onDelete: Cascade`; fields cover Pomodoro config, daily goal, notifications, appearance, privacy, analytics; appearance includes `theme` and `accentColor` (accent palette key, `@default("blue")`) |
| `Subject` | `id`, `userId`, `name`, `colorHex` | Belongs to one user; has many sessions and tasks |
| `Session` | `id`, `userId`, `subjectId`, `startedAt`, `endedAt?`, `durationSeconds?`, `pomodoroRound?`, `type` (FOCUS \| POMODORO), `note?` | `endedAt`/`durationSeconds` are null until `completeSession` is called; `pomodoroRound` is set only on POMODORO sessions; `note` is set only on manual sessions |
| `Task` | `id`, `userId`, `title`, `subjectId?`, `dueDate?`, `estimatedMinutes?`, `completed`, `completedAt?`, `carriedOver`, `isRecurring` (default false), `recurringDays Int[]`, `createdAt` | `carriedOver` flags tasks rolled from a previous day; `isRecurring` + `recurringDays` define weekly repeat schedule |
| `RecurringTaskCompletion` | `id`, `taskId`, `userId`, `date` (YYYY-MM-DD), `completedAt` | Per-day completion record for recurring tasks; `@@unique([taskId, date])` |
| `Achievement` | `id`, `userId`, `type` (enum), `unlockedAt` | Achievement types: FIRST_SESSION, STREAK_3/7, TOTAL_1H/10H/100H, EARLY_BIRD, NIGHT_OWL |
| `Group` | `id`, `name`, `inviteCode` (unique), `isPublic` (default false), `maxMembers` (default 20), `createdAt` | Full CRUD via `/api/groups` routes; invite code auto-generated on create |
| `GroupMember` | `id`, `groupId`, `userId`, `isAdmin` (default false), `joinedAt`; `@@unique([groupId, userId])`; `onDelete: Cascade` on group relation | Junction table — creator has `isAdmin: true`; backend verifies `isAdmin` on all three admin-only group endpoints |
| `ScheduleEvent` | `id`, `userId`, `title`, `date` (YYYY-MM-DD), `startTime` (HH:MM), `durationMinutes` (default 60), `subjectId?`, `isRecurring`, `recurringDays (Int[])`, `color?` | One-off or recurring events in the daily planner |

### Schema operations

- `npx prisma db push` — apply schema changes (**never** `npx prisma migrate dev` — requires shadow DB)
- `npx prisma generate` — regenerate client after schema changes
- `npx prisma studio` — GUI browser
- **`npx prisma dev` must be running first** (separate terminal) — starts the local Postgres proxy on port 51214

## API Endpoints

All routes are under `/api`. Auth routes have no authentication; all others require a valid app JWT (`Authorization: Bearer <token>`).

### Auth — `POST /api/auth/*` (no auth required)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/supabase` | Option B token exchange — validates Supabase access token, upserts user, returns app JWT + user payload |
| `POST` | `/api/auth/register` | Email/password registration — creates user, returns app JWT |
| `POST` | `/api/auth/login` | Email/password login — verifies bcrypt hash, returns app JWT |

### Users — auth required

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users/me` | Fetch caller's profile (reads userId from JWT) |
| `PATCH` | `/api/users/me` | Update caller's name, handle, avatar, or dailyGoalSeconds |
| `GET` | `/api/users/me/stats` | Lifetime stats: totalHours, totalSessions, totalSubjects, daysActive, totalSeconds, topSubject |
| `GET` | `/api/users/me/group` | Caller's current group + members with todaySeconds; 404 if not in any group |
| `GET` | `/api/users/me/insights?period=week\|month\|allTime&subjectId=` | Insights: totalSeconds, dailyAverageSeconds, bestDaySeconds, heatmap [{date,seconds}], bySubject (sorted desc with %), dailyBreakdown (7/30/12 entries), streak, totalSessions; period accepts `week`, `month`, `allTime` (aliases: `all` → `allTime`); optional `subjectId` filters all aggregates to one subject — unrecognised subjectId returns empty stats (no 400) |
| `GET` | `/api/users/me/preferences` | Fetch caller's full preferences; upserts with all defaults on first call |
| `PATCH` | `/api/users/me/preferences` | Update any subset of preference fields; body key `longBreakAfter` maps to `longBreakAfterRounds` in DB; returns full updated preferences |
| `GET` | `/api/users/:id/profile` | Fetch user profile by ID (legacy) |
| `PATCH` | `/api/users/:id/preferences` | Update preferences by ID (legacy) |

### Subjects — auth required

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/subjects` | Create a subject (`name`, `colorHex` — must be `#RRGGBB`); userId from JWT |
| `GET` | `/api/subjects` | List caller's subjects, ordered by createdAt asc; userId from JWT |
| `DELETE` | `/api/subjects/:id` | Delete a subject by ID |

### Sessions — auth required

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sessions/start` | Create a new session (`subjectId`, `type: FOCUS\|POMODORO`, optional `pomodoroRound`); userId from JWT |
| `PATCH` | `/api/sessions/:id` | Partial update — set `endedAt` and/or `durationSeconds` |
| `POST` | `/api/sessions/:id/complete` | Complete a session — sets `endedAt` to now, computes duration from elapsed time if not provided; accepts optional `note` string (max 500 chars, trimmed before save) |
| `POST` | `/api/sessions/manual` | Create a completed past session (`subjectId`, `startedAt`, `endedAt`, optional `note`); validates duration ≤12h, not future, not >30 days past, subject ownership |
| `GET` | `/api/sessions/today?date=YYYY-MM-DD` | List caller's completed sessions for today (UTC) or a specific date if `date` param provided; returns `{ id, subjectId, subjectName, startedAt, elapsedSeconds }` |
| `GET` | `/api/sessions?subjectId=` | List caller's sessions, newest first; userId from JWT; optional subjectId filter |

### Tasks — auth required

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/tasks?date=` | List caller's tasks; optional `date` returns non-recurring tasks due that day + recurring tasks matching day-of-week; recurring tasks include `completedOnDate` and `completedAtOnDate` |
| `POST` | `/api/tasks` | Create a task (`title`, optional `subjectId`, `dueDate`, `isRecurring`, `recurringDays`); userId from JWT |
| `PATCH` | `/api/tasks/:id` | Update task fields; for recurring tasks + `completed` present: upserts/deletes `RecurringTaskCompletion` for `date` instead of flipping `task.completed` |
| `DELETE` | `/api/tasks/:id` | Delete task (ownership check) |

### Schedule Events — auth required

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/schedule-events?date=YYYY-MM-DD` | Events for user on that date + recurring events matching day of week |
| `POST` | `/api/schedule-events` | Create event (`title`, `date`, `startTime`, `durationMinutes`, optional `subjectId`, `isRecurring`, `recurringDays`, `color`) |
| `PATCH` | `/api/schedule-events/:id` | Update event fields (ownership check) |
| `DELETE` | `/api/schedule-events/:id` | Delete event (ownership check) |

### Groups — auth required

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/groups` | Create a group (`name`, optional `isPublic`, `maxMembers`); auto-generates unique 6-char `inviteCode`; creator added as first member |
| `POST` | `/api/groups/join-by-code` | Join group by invite code (`inviteCode`); 404 if not found, 409 if already member, 400 if full |
| `GET` | `/api/groups/search?q=name` | Search public groups by name (case-insensitive, min 2 chars); excludes groups user is already in; returns `memberCount` |
| `GET` | `/api/groups/:id` | Group details + all members with `todaySeconds` (today's study time) |
| `POST` | `/api/groups/:id/join` | Add caller to group; 409 if already a member |
| `DELETE` | `/api/groups/:id/leave` | Remove caller from group; 404 if not a member |
| `PATCH` | `/api/groups/:id` | Admin-only: update `name`, `isPublic`, `maxMembers`; validates `maxMembers` ≥ current member count |
| `POST` | `/api/groups/:id/regenerate-code` | Admin-only: generate new unique 6-char invite code; old code immediately invalid |
| `DELETE` | `/api/groups/:id` | Admin-only: delete group + emit `group_deleted` socket event to room before DB deletion; cascade handles GroupMember cleanup |
| `GET` | `/api/groups/:id/activity?limit=20` | Activity feed — events: `session_complete`, `session_start`, `streak_milestone`, `member_join`; sorted newest first |
| `GET` | `/api/groups/:id/leaderboard?period=today` | Members ranked by study duration; `period`: `today` (default), `week`, `month`; includes `rank`, `rankChange` (always 0 — no historical snapshots), `subjectName`, `subjectColor` |

### Leaderboard — auth required (legacy)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/leaderboard?scope=group&groupId=` | Legacy group leaderboard — all-time totals; prefer `/api/groups/:id/leaderboard` for period filtering |

### Stats — auth required

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/stats/heatmap?month=YYYY-MM` | Returns `[{ date, seconds }]` aggregated by day for the given calendar month; userId from JWT |

### Achievements — auth required

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users/me/achievements` | List caller's own unlocked achievements, newest first |
| `GET` | `/api/users/:id/achievements` | List all unlocked achievements for a user, newest first |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Returns `{ status: 'ok' }` — no auth |

## Auth Architecture

Option B token exchange: mobile completes Supabase auth → POSTs Supabase token to `POST /api/auth/supabase` → backend validates via `supabaseAdmin.auth.getUser()`, upserts user, returns 30-day app JWT → mobile stores in SecureStore.

**Public routes:** `/api/health`, `POST /api/auth/supabase`, `POST /api/auth/register`, `POST /api/auth/login`

**Protected routes:** all others use `{ preHandler: authenticate }` which calls `request.jwtVerify()`.

## Environment Variables

| Key | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Direct `postgres://` TCP URL from `npx prisma dev` output (default: `postgres://postgres:postgres@localhost:51214/template1?...`). `npx prisma dev` must be running. |
| `JWT_SECRET` | Yes | Secret for signing/verifying app JWTs (`@fastify/jwt`). App won't start if missing (passed to `jwt` plugin with `!`). |
| `PORT` | No | Server port (default 3000) |
| `SUPABASE_URL` | Yes | Supabase project URL — used by admin client in `supabase-auth.controller.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key — grants `auth.getUser()` access. Keep secret, never expose to clients. |

`dotenv` is imported as the **first line** of `server.ts` (`import 'dotenv/config'`). If it's moved below other imports, env vars will be undefined when plugins initialize.

## Request / Response Conventions

Success: `{ "data": { ... } }` — Error: `{ "error": "message" }`

POST and PATCH routes must define `schema.body` in route options (Fastify validates before handler runs).

## Socket.io

- **Namespace:** `/groups`
- **Handler file:** `src/socket/groups.socket.ts` — `registerGroupSocketHandlers(io, prisma)` called from `src/plugins/socket.ts`
- **Room naming:** `group_${groupId}` (e.g. `group_cmbxyz123...`)
- **Access via Fastify:** `request.server.io` in controllers (decorated by `src/plugins/socket.ts`)

### Client → Server events

| Event | Payload | Effect |
|---|---|---|
| `join_group_room` | `{ groupId, userId }` | Socket joins `group_${groupId}`, stores `socket.data.{userId,groupId}`, emits `room_state` back |
| `session_started` | `{ userId, subjectName, subjectColor, elapsedSeconds }` | Broadcasts `member_status_update` + `activity_feed_update(session_start)` to room |
| `session_tick` | `{ userId, elapsedSeconds }` | Broadcasts `member_status_update` (status=studying, updated elapsed) to room |
| `session_paused` | `{ userId }` | Broadcasts `member_status_update` (status=paused) to room |
| `session_completed` | `{ userId, subjectName, durationSeconds }` | Broadcasts `member_status_update` (status=idle) + `activity_feed_update(session_complete)` + `leaderboard_update` to room |
| `streak_milestone` | `{ userId, streakCount }` | Broadcasts `activity_feed_update(streak_milestone)` to room |
| `leave_group_room` | `{ groupId }` | Socket leaves the room |

### Server → Client events

| Event | Payload | When |
|---|---|---|
| `room_state` | `{ members }` | Sent to newly joined socket; members from DB (no real-time status) |
| `member_status_update` | `{ userId, status, subjectName?, elapsedSeconds }` | When any member's session state changes or on disconnect |
| `activity_feed_update` | `{ type, userId, subjectName?, durationSeconds?, metadata?, createdAt }` | When session starts/completes or streak milestone reached |
| `leaderboard_update` | (empty) | After session complete — signals clients to refetch leaderboard |
| `group_deleted` | `{ groupId, message }` | Emitted to `group_${groupId}` room before group is deleted; non-admin members use this to show an alert and reset to NoGroupView |

### Server-side emit from HTTP controllers

`completeSession` in `sessions.controller.ts` also emits `member_status_update` (idle) and `leaderboard_update` to the group room via `request.server.io` after the DB update, in case the client socket is not connected.

## Critical Rules

- **Never expose stack traces in error responses** — the global `errorHandler` only forwards `error.message`. This is already enforced; do not change it to include `error.stack`.
- **Always validate request body with Fastify JSON schema** on POST and PATCH routes — add a `schema.body` block in route options, not in the controller.
- **Single Prisma client instance** — created once in `src/plugins/prisma.ts` and accessed via `request.server.prisma`. Never call `new PrismaClient()` anywhere else.
- **All routes must be registered with prefix `/api`** — enforced in `server.ts` via `{ prefix: '/api' }` on every `app.register()` call.
- **`dotenv` must be the first import in `server.ts`** — `import 'dotenv/config'` is line 1. Moving it breaks env var availability in all plugins.
- **Use `npx prisma db push` not `npx prisma migrate dev`** — `migrate dev` requires a shadow database that the Prisma Postgres local proxy does not support.
- **`npx prisma dev` must be running** before starting the server, pushing schema, or opening Studio. Start it in a separate terminal. `DATABASE_URL` is a direct `postgres://` TCP string to PostgreSQL on port 51214 (default) — if nothing is listening every Prisma query throws → 500. The error is surfaced via `request.log.error` in the error handler.
- **`DATABASE_URL` must be a `postgres://` TCP string** — the `prisma+postgres://` HTTP proxy URL is not compatible with PrismaClient 7.8.0. Always use the direct TCP URL output by `npx prisma dev`.
- **Never accept `userId` from the request body or query string** — always read it from `request.user.id` (the verified JWT payload). Client-supplied userIds allow any authenticated user to read or write another user's data.
- **Register `/me` routes before `/:id` routes** — in `src/routes/users.ts`, the static `/users/me` and `/users/me/*` routes must be registered before `/users/:id/profile` and `/users/:id/preferences`. Fastify resolves static path segments first, but registration order is the safe guard; reversing it risks `me` being matched as an `:id` param in edge cases.
- **Register `/users/me/achievements` before `/users/:id/achievements`** — the static `/me/` path must be registered first so `me` is not captured as the `:id` param.

## Known Issues & Workarounds

- **Leaderboard scope is group-only:** `GET /api/leaderboard` (legacy) only supports `scope=group`. The `category` and `global` scope values shown in the frontend `LeaderboardScreen` display "Coming Soon" — use `GET /api/groups/:id/leaderboard` for group leaderboards going forward.
- **showInLeaderboard filter scope is group leaderboard only:** `GET /api/groups/:id/leaderboard` filters out members with `showInLeaderboard=false` in `UserPreferences`. The legacy `GET /api/leaderboard` endpoint does not apply this filter.
- **Streak computed on every login:** The streak calculation in `supabaseLogin` runs a full session query on every OAuth login. This is acceptable at current scale but should be moved to a scheduled job or cached field before high-traffic launch.
- **Prisma dev must be running before the backend:** `npx prisma dev` starts the local Postgres proxy on port 51214. Without it, every route returns 500.
- **Streak in `GET /users/me/insights` is period-limited:** The streak is computed from `dayMap`, which is scoped to the period's `startDate`. For `period=week` the streak caps at 7, for `period=month` at 30. Only `period=allTime` returns the true streak. The frontend "Current Streak" card should ideally always pass `allTime`, or streak should be computed independently of the period filter.

## Next Steps

- Deploy to Railway or Fly.io; switch `DATABASE_URL` to production Prisma Postgres URL; set all env vars in platform secret manager

---

⚠️ **MODIFY THIS FILE** whenever any of the following happen:
- A new route or endpoint is added
- A new Prisma model or field is added
- A new package is installed
- Auth flow changes
- A new environment variable is added
- A known issue is discovered or resolved
- Any critical rule is established during a session
