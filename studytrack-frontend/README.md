# StudyTrack

A mobile study-timer app for logging focused sessions, tracking streaks, viewing insights, and competing in real-time study groups.

## Repository Structure

```
StudyTrack/          ← React Native (Expo) frontend
backend/             ← Fastify + Prisma REST API + Socket.io
```

## Tech Stack

| Layer | Stack |
|---|---|
| Mobile | React Native 0.81 + Expo ~54 (managed workflow) |
| Navigation | React Navigation v7 (native stack + bottom tabs) |
| State | Zustand v5 |
| Auth | Supabase (Google OAuth + email/password) + custom JWT |
| HTTP | Axios |
| Real-time | Socket.io v4 |
| Backend | Fastify v5 + TypeScript |
| Database | PostgreSQL via Prisma v7 |
| Deployment | Expo Go (dev) · Railway / Fly.io (prod) |

## Features

- **Timer** — Count-up session timer with animated SVG ring showing daily goal progress
- **Subjects** — Color-coded subject picker; sessions tagged to a subject
- **Streaks & goals** — Daily goal ring, consecutive-day streak tracking
- **Insights** — Study heatmap, weekly bar chart, subject distribution breakdown
- **Daily Planner** — Task list per day with completion toggles
- **Study Groups** — Real-time group presence (Socket.io): see who's studying live, activity feed, leaderboard
- **Interrupted session resume** — Session state persisted to AsyncStorage; resume prompt on next launch
- **Background timer handling** — AppState listener saves a timestamp when the app backgrounds; on foreground, elapsed time is added to the timer (< 15 min) or the session is auto-completed and the user is taken to the summary screen (≥ 15 min); AsyncStorage persistence survives OS kills

## Getting Started

### Prerequisites

- Node.js 18+
- Expo Go app on a physical Android device
- PostgreSQL database (local or hosted)
- Supabase project (for auth)

### Frontend

```bash
cd StudyTrack        # repo root
npm install
cp .env.example .env # fill in your values
npx expo start --clear
```

Scan the QR code with Expo Go.

**Required `.env` keys:**

```
EXPO_PUBLIC_API_URL=http://<your-local-ip>:3000/api
EXPO_PUBLIC_WS_URL=ws://<your-local-ip>:3000
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET
npx prisma migrate deploy
npm run dev
```

**Required `.env` keys:**

```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
JWT_SECRET=<random-secret>
PORT=3000
```

## Auth Flow

1. User signs in via Google OAuth or email/password through Supabase
2. Frontend exchanges the Supabase access token with the backend (`POST /api/auth/supabase`)
3. Backend validates via Supabase admin client, upserts user in Postgres, returns a 30-day app JWT
4. JWT stored in `expo-secure-store`; injected on every API request via Axios interceptor

## Project Status

Core features complete and tested on a physical Android device via Expo Go. Backend deployment to Railway/Fly.io and Play Store submission are the remaining steps.
