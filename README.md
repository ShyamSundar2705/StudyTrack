# StudyTrack

A mobile study-timer app for tracking focused study sessions, planning tasks, viewing insights, and competing in study groups.

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo (managed workflow) |
| Backend | Node.js, TypeScript, Fastify v5 |
| Database | PostgreSQL via Prisma ORM |
| Auth | Supabase (Google OAuth + email/password) + app JWT |
| Real-time | Socket.io (`/groups` namespace) |
| State | Zustand |

## Monorepo Structure

```
StudyTrack/
├── studytrack-frontend/   — React Native / Expo app
└── studytrack-backend/    — Fastify REST API + Socket.io server
```

## Features

- Study session timer with focus and Pomodoro modes
- Subject management with color coding and per-subject daily goals
- Per-subject stats: weekly trend chart, daily goal ring, session history with filter tabs, study-now shortcut
- Daily planner with tasks and schedule events
- Insights: heatmap, subject breakdown, weekly bar chart, streaks
- Live study groups with real-time member status and leaderboard
- Google OAuth and email/password authentication
- Manual session logging and session notes
- Push notifications for Pomodoro phases, daily reminders, and milestones
- Dark/light theme toggle and privacy settings

## Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo`)
- Expo Go app on a physical Android device
- Supabase project (for auth)
- Prisma CLI (`npx prisma`)

## Getting Started

### Backend

```bash
cd studytrack-backend
npm install
```

Copy `.env.example` to `.env` and fill in the required values:

```
DATABASE_URL=postgres://...  # Direct TCP URL from Prisma Postgres cloud
JWT_SECRET=your_jwt_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3000
```

> **Note:** The database is hosted on **Prisma Postgres** (cloud). `npx prisma dev` is not required — `DATABASE_URL` should be the direct `postgres://` TCP URL obtained via `npx prisma postgres link`.

Generate the Prisma client:

```bash
npx prisma generate
```

Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3000/api`.

### Frontend

```bash
cd studytrack-frontend
npm install
```

Copy `.env` and set your values:

```
EXPO_PUBLIC_API_URL=http://192.168.0.106:3000/api
EXPO_PUBLIC_WS_URL=ws://192.168.0.106:3000
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Start the Expo development server:

```bash
npx expo start --clear
```

Scan the QR code with Expo Go on your Android device.

## API Overview

All REST endpoints are prefixed with `/api`. Protected routes require an `Authorization: Bearer <token>` header.

| Resource | Prefix |
|---|---|
| Auth | `POST /api/auth/*` |
| Users & Preferences | `GET/PATCH /api/users/me` |
| Subjects | `/api/subjects` |
| Sessions | `/api/sessions` |
| Tasks | `/api/tasks` |
| Schedule Events | `/api/schedule-events` |
| Groups | `/api/groups` |
| Leaderboard | `/api/groups/:id/leaderboard` |
| Stats | `/api/stats/heatmap` |
| Health | `GET /api/health` |

See `studytrack-backend/CLAUDE.md` for the full endpoint reference.

### Response conventions

- Success: `{ "data": { ... } }`
- Error: `{ "error": "message" }`

All protected routes require `Authorization: Bearer <token>`.

## Socket.io

Namespace: `/groups` — connect with `io("ws://<host>", { path: "/socket.io" })` then `socket.of("/groups")`.

Room naming: `group_<groupId>`.

### Client → Server

| Event | Payload | Effect |
|---|---|---|
| `join_group_room` | `{ groupId, userId }` | Joins room; server sends `room_state` back |
| `session_started` | `{ userId, subjectName, subjectColor, elapsedSeconds }` | Broadcasts start status + activity entry |
| `session_tick` | `{ userId, elapsedSeconds }` | Broadcasts updated elapsed time to room |
| `session_paused` | `{ userId }` | Broadcasts paused status to room |
| `session_completed` | `{ userId, subjectName, durationSeconds }` | Broadcasts idle status + activity entry + `leaderboard_update` |
| `streak_milestone` | `{ userId, streakCount }` | Broadcasts streak activity entry to room |
| `leave_group_room` | `{ groupId }` | Leaves the room |

### Server → Client

| Event | Payload | When |
|---|---|---|
| `room_state` | `{ members }` | Immediately after `join_group_room` |
| `member_status_update` | `{ userId, status, subjectName?, elapsedSeconds }` | On any session state change or disconnect |
| `activity_feed_update` | `{ type, userId, subjectName?, durationSeconds?, metadata?, createdAt }` | On session start/complete or streak milestone |
| `leaderboard_update` | _(empty)_ | After session complete — signal to refetch leaderboard |

## Achievements

Achievements are unlocked automatically by the backend when session milestones are hit.

| Type | Trigger |
|---|---|
| `FIRST_SESSION` | First completed session |
| `STREAK_3` | 3-day study streak |
| `STREAK_7` | 7-day study streak |
| `TOTAL_1H` | 1 total hour studied |
| `TOTAL_10H` | 10 total hours studied |
| `TOTAL_100H` | 100 total hours studied |
| `EARLY_BIRD` | Session started before 7 AM |
| `NIGHT_OWL` | Session started after 10 PM |

Fetch via `GET /api/users/:id/achievements`.

## Deployment

### Backend (Railway / Fly.io)

1. Provision a PostgreSQL database on the platform and copy the connection string.
2. Set all required environment variables (`DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`).
3. Remove `npx prisma dev` — that's local only. Set `DATABASE_URL` to the hosted `postgres://` URL.
4. Run `npx prisma db push && npx prisma generate` in the build step.
5. Start command: `npm run start` (or `node dist/server.js` for a compiled build).

### Frontend (Expo / EAS)

1. Update `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WS_URL` to the deployed backend URL.
2. Build an APK or AAB with `eas build --platform android --profile production`.
3. Submit to the Play Store with `eas submit`.

## Troubleshooting

**`Can't reach development server`** on device — the `EXPO_PUBLIC_API_URL` must be your machine's LAN IP (e.g. `192.168.x.x`), not `localhost`.

**Tasks/events appear on the wrong date** — timezone mismatch. The frontend builds dates from local date parts (`getFullYear/getMonth/getDate`), not `toISOString()`. The API expects `YYYY-MM-DD` strings in the device's local calendar date.

**Prisma client out of sync** — run `npx prisma generate` after any `schema.prisma` change. The generated client lives in `generated/prisma/client/` and must match the current schema.

**`409 Conflict` on group join** — user is already a member. The join endpoint guards against duplicate `(groupId, userId)` pairs in application code.

## Development Notes

- The database is Prisma Postgres cloud — no local proxy (`npx prisma dev`) is needed. `DATABASE_URL` points directly to the hosted `postgres://` TCP URL.
- Use `npx prisma migrate dev` to apply schema changes (Prisma Postgres supports migrations natively; no shadow DB issue).
- Test on a physical Android device via Expo Go; the emulator behaves differently for deep links and secure storage.
- Run `npx expo start --clear` after any `.env` or `app.json` change.

## Environment Variables

### Backend (`studytrack-backend/.env`)

| Key | Description |
|---|---|
| `DATABASE_URL` | Direct `postgres://` TCP URL from `npx prisma dev` |
| `JWT_SECRET` | Secret for signing app JWTs |
| `PORT` | Server port (default: 3000) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

### Frontend (`studytrack-frontend/.env`)

| Key | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL including `/api` suffix |
| `EXPO_PUBLIC_WS_URL` | WebSocket URL for Socket.io |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
