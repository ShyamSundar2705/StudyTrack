# StudyTrack — Frontend

## Project Overview

StudyTrack is a mobile study-timer app inspired by YPT (Your Progress Tracker). Users log focused study sessions by subject, track daily streaks, view insights, plan tasks, and compete in study groups. The app is built with React Native + Expo managed workflow and targets Android physical devices via Expo Go during development.

## Folder Structure

```
polyfills.js   — crypto polyfills; MUST be first import in index.js
index.js       — entry point (import './polyfills' is line 1)
src/
  api/         — client.js, supabase.js, socket.js, users.js, subjects.js, sessions.js, tasks.js, leaderboard.js
  components/  — AuthModal, BottomSheetPicker, ManualLogModal, DatePickerModal, TimePickerModal,
                 NoteBottomSheet, SessionActionSheet, SubjectSwitchSheet, TaskFormSheet, ScheduleEventFormSheet,
                 PlannerActionSheet
  constraints/ — theme.js (colors, spacing, radius — folder is "constraints" not "constants")
  navigation/  — AppNavigator.jsx, navigationRef.js
  screens/     — SplashScreen, SubjectSetupScreen, HomeTimerScreen, SessionActiveScreen,
                 SessionCompleteScreen, DailyPlannerScreen, InsightsScreen, SubjectDetailsScreen,
                 StudyGroupsScreen, LeaderboardScreen, ProfileScreen, AppSettingsScreen
  store/       — useUserStore, useSubjectStore, useSessionStore, useTimerStore, usePomodoroStore
  utils/       — notifications.js, dateTime.js (includes formatRecurringLabel for recurring day labels), shareSession.js
```

## Design System

All colors, spacing, and radii live in `src/constraints/theme.js`. **Never hardcode hex values in screens.**

### Colors

| Token | Value | Semantic meaning |
|---|---|---|
| `background` | `#0F0F0F` | App background — near-black |
| `surface` | `#1E1E1E` | Cards, modals, sheet backgrounds |
| `surfaceDeep` | `#161616` | Deeper inset surfaces (heatmap empty cells) |
| `surfaceBlue` | `#0D1526` | Dark blue tint — used in active session ring area |
| `surfaceElevated` | `#1A2744` | Blue-tinted elevated card (leaderboard podium, insights) |
| `accentPrimary` | `#2D6BE4` | Primary blue — focus ring, active states, CTAs |
| `accentLight` | `#4A90E2` | Lighter blue — heatmap l4 intensity, icon accents |
| `textPrimary` | `#FFFFFF` | Primary text |
| `textSecondary` | `#9E9E9E` | Muted labels, timestamps, placeholders |
| `textDark` | `#333333` | Dark text on light backgrounds (Google button label) |
| `border` | `#2A2A2A` | Tab bar border, card dividers |
| `danger` | `#E74C3C` | Errors, destructive actions, subject color option |
| `dangerLight` | `#FFCDD2` | Light danger tint — sign-out row background |
| `success` | `#27AE60` | Positive states, subject color option |
| `warning` | `#FF6B2B` | Warning badges, subject color option |
| `gold` | `#FFD700` | Leaderboard #1 / achievement highlight |
| `silver` | `#C0C0C0` | Leaderboard #2 |
| `bronze` | `#CD7F32` | Leaderboard #3 |
| `accent2` | `#A855F7` | Purple — secondary subject color, tag backgrounds |

### Spacing

```
xs: 4  |  sm: 8  |  md: 12  |  lg: 16  |  xl: 20  |  xxl: 24
```

### Border Radius

```
sm: 8  |  md: 12  |  lg: 14  |  xl: 16  |  xxl: 20
```

## Screen Inventory

Components added in batch 4: `SubjectFilterSheet` — modal bottom sheet for filtering insights by subject; props: `visible`, `selectedSubjectId`, `onSelect`, `onClose`, `subjectHours`.

| Screen file | Route name | Location | Description |
|---|---|---|---|
| `SplashScreen.jsx` | `Splash` | Auth stack | Google OAuth + email/password login via `AuthModal`, session restore on launch, backend pre-flight health check |
| `SubjectSetupScreen.jsx` | `SubjectSetup` | Auth stack | Onboarding — create initial subjects before entering app |
| `HomeTimerScreen.jsx` | `HomeTimer` | HomeTab stack | Main timer ring, subject picker, today's sessions list |
| `SessionActiveScreen.jsx` | `SessionActive` | Root stack (fullscreen) | Live countdown/countup timer during an active session |
| `SessionCompleteScreen.jsx` | `SessionComplete` | Root stack (fullscreen) | Summary card after session ends; start-another shortcut |
| `DailyPlannerScreen.jsx` | `DailyPlanner` | PlannerTab stack | Weekly date strip + task list for selected day |
| `InsightsScreen.jsx` | `Insights` | InsightsTab stack | Study heatmap, subject breakdown bars, weekly bar chart |
| `SubjectDetailsScreen.jsx` | `SubjectDetails` | InsightsTab stack (drill-down) | Per-subject time history and weekly bar chart |
| `StudyGroupsScreen.jsx` | `StudyGroups` | GroupsTab stack | Live active members, top contributors, group stats |
| `LeaderboardScreen.jsx` | `Leaderboard` | GroupsTab stack (drill-down) | Podium + ranked list; scope (group/category/global) |
| `ProfileScreen.jsx` | `Profile` | ProfileTab stack | User stats, subjects list, daily goal ring |
| `AppSettingsScreen.jsx` | `AppSettings` | ProfileTab stack (drill-down) | Notifications toggle, Pomodoro config pickers, sign-out |

## Navigation Structure

```
NavigationContainer (linking: studytrack:// prefix, auth/callback → Splash)
└── RootStack (no header)
    ├── Auth (AuthStack, no header)           ← initial screen
    │   ├── Splash
    │   └── SubjectSetup
    ├── Main (BottomTabNavigator)
    │   ├── HomeTab → HomeStack
    │   │   └── HomeTimer
    │   ├── PlannerTab → PlannerStack
    │   │   └── DailyPlanner
    │   ├── InsightsTab → InsightsStack
    │   │   ├── Insights
    │   │   └── SubjectDetails       ← pushed from Insights
    │   ├── GroupsTab → GroupsStack
    │   │   ├── StudyGroups
    │   │   └── Leaderboard          ← pushed from StudyGroups
    │   └── ProfileTab → ProfileStack
    │       ├── Profile
    │       └── AppSettings          ← pushed from Profile
    ├── SessionActive                ← pushed from HomeTimer (fullscreen, no tab bar)
    └── SessionComplete              ← pushed from SessionActive (fullscreen)
```

### Auth transitions

Always use `navigation.replace()` (not `navigate`) for auth-to-app transitions.

## State Management

All stores are Zustand vanilla stores (no persist middleware).

**Rule: never fetch data inside a component. Use store actions or `useEffect` hooks.**

### `useUserStore`
Fields: `id`, `name`, `handle`, `avatar`, `streak`, `totalHours`, `dailyGoalSeconds`, `preferences` (full UserPreferences object, populated after auth)
Actions: `setUser(userData)`, `updateStreak(n)`, `setPreferences(partial)`, `reset()`

### `useSubjectStore`
Fields: `subjects` — `[{ id, name, color, totalSeconds }]`
Actions: `addSubject`, `removeSubject`, `updateSubject`, `setSubjects`

### `useSessionStore`
Fields: `activeSession` — `{ subjectId, backendSessionId, startedAt, elapsedSeconds, isPaused, pausedAt }` (null if none); `todaySessions` — `[{ id, subjectId, subjectName, startedAt, elapsedSeconds }]`
Actions: `startSession(subjectId, backendSessionId?)`, `pauseSession`, `resumeSession`, `stopSession`, `logSession`, `addSession`, `setTodaySessions`, `abandonSession` (null without saving), `switchSubject` (updates subjectId in-place)

### `useTimerStore`
Fields: `isRunning`, `elapsedSeconds`, `isCountdown`, `totalSeconds`, `intervalId`, `tickIntervalId`
Actions: `startTimer(isCountdown?, totalSeconds?)`, `pauseTimer`, `resetTimer`, `setElapsedSeconds`
`startTimer()` runs a 1-second UI tick + 30-second socket `session_tick`. In countdown mode, reaching zero calls `advancePhase()`. In normal mode, each tick calls `checkAndFireMilestone` (alerts at 30m/1h/2h/daily goal).

### `usePomodoroStore`
Fields: `config` — `{ focusMinutes, shortBreakMinutes, longBreakMinutes, longBreakAfter, autoStartBreaks }`; `isPomoMode`, `currentPhase` (`focus|short_break|long_break`), `currentRound`, `completedRounds`
Actions: `setConfig`, `enablePomoMode`, `disablePomoMode`, `advancePhase`, `getCurrentPhaseDuration`, `resetPomo`

## API Layer

### Client setup (`src/api/client.js`)

- **Base URL:** `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api'`
- **Timeout:** 10 seconds
- **Auth token key:** `TOKEN_KEY = 'studytrack_token'` (exported constant — use this everywhere, never the raw string)
- **Request interceptor:** reads JWT from SecureStore and injects `Authorization: Bearer <token>` header automatically
- **401 interceptor:** deletes token from SecureStore, signs out of Supabase, resets user store, and imperatively resets navigation to Auth stack via `navigationRef`

### API modules

| File | Functions |
|---|---|
| `src/api/users.js` | `getMe`, `updateMe`, `getStats`, `getInsights(period, subjectId?)`, `getMyGroup`, `getPreferences`, `updatePreferences`, `signInWithGoogle`, `signInWithEmail`, `signOut` |
| `src/utils/shareStats.js` | `shareInsightsStats({ period, totalSeconds, dailyAverageSeconds, bestDaySeconds, bySubject, streak, userName })` — builds formatted text and opens native share sheet |
| `src/api/subjects.js` | `getSubjects`, `getSubjectDetails`, `createSubject` |
| `src/api/sessions.js` | `getTodaySessions`, `startSession`, `completeSession`, `manualSession`, `getSessionsBySubject` |
| `src/api/tasks.js` | `getTasks`, `createTask`, `updateTask`, `deleteTask` |
| `src/api/leaderboard.js` | `getLeaderboard`, `getGroupLeaderboard` |
| `src/api/socket.js` | `getGroupSocket()`, `disconnectGroupSocket()` — Socket.io singleton for `/groups` namespace |
| `src/api/supabase.js` | Supabase client instance (not an API module — auth only) |

## Auth Flow

Both Google OAuth and email/password flow through Supabase → backend `POST /api/auth/supabase` (token exchange) → app JWT saved in SecureStore. On launch, `supabase.auth.getSession()` restores the session if cached in AsyncStorage.

### Critical auth config

- `supabase.js` storage must be `AsyncStorage` (not SecureStore) — SecureStore drops the PKCE code verifier between OAuth steps
- `flowType: 'pkce'` must be set explicitly on the Supabase client
- `redirectTo` in `signInWithOAuth` must be `'exp://192.168.0.106:8081'` — the second arg to `WebBrowser.openAuthSessionAsync` must match exactly
- Pass only the extracted `code` to `exchangeCodeForSession` — never the full URL: `new URL(result.url).searchParams.get('code')`
- JWT key: `studytrack_token` in SecureStore (use exported `TOKEN_KEY` from `src/api/client.js`)

## Environment Variables

All Expo-side env vars must be prefixed `EXPO_PUBLIC_` to be embedded in the bundle.

| Key | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL **including** `/api` suffix (e.g. `http://192.168.0.106:3000/api`) — the axios client uses this as `baseURL` directly |
| `EXPO_PUBLIC_WS_URL` | WebSocket URL for Socket.io (same host, `ws://` scheme) |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

Values are in `.env` (gitignored). Run `npx expo start --clear` after any `.env` change.

## Critical Rules

- **Never hardcode hex colors** — always use tokens from `src/constraints/theme.js`
- **Never put business logic in screen components** — use store actions or api module functions
- **All screens must handle 3 states:** loading (ActivityIndicator), data (rendered UI), error (Alert or inline message)
- **Use `navigation.replace()` not `navigation.navigate()`** for auth→app transitions to prevent back navigation
- **Run `npx expo start --clear`** after any `.env`, `app.json`, or package change
- **Test on physical Android device** via Expo Go — not the emulator (camera, deep links, and secure store behave differently)
- **Import theme from `../constraints/theme`** — the folder is named `constraints`, not `constants`
- **Use `TOKEN_KEY`** from `src/api/client.js` wherever the SecureStore key is needed — never the raw string `'studytrack_token'`
- **`polyfills.js` must be the first import in `index.js`** — Babel hoists ES imports, so polyfill setup code in the same file as `App` runs too late. The dedicated module ensures `crypto.subtle` is patched before Supabase initializes.
- **`redirectTo` and `openAuthSessionAsync` second arg must be identical** — if they differ, the browser never closes automatically and `result.type` will be `'dismiss'` instead of `'success'`
- **`EXPO_PUBLIC_API_URL` must include the `/api` suffix** — the axios client uses it as `baseURL` directly; omitting `/api` causes every request to 404
- **Never use Zustand object selectors** — `useStore((s) => ({ a: s.a, b: s.b }))` creates a new object reference on every render; React 18's `useSyncExternalStore` triggers infinite re-renders. Always use separate scalar selectors.
- **Never add custom nav bar JSX to screen components** — navigation is handled entirely by React Navigation's `Tab.Navigator` in `AppNavigator.jsx`.
- **Always use `useSafeAreaInsets()` in screen headers** — apply `{ paddingTop: insets.top + spacing.md }` as an inline style; do not use `height: 64`.
- **Tab bar height must include `insets.bottom`** — computed inside `MainTabs` with `height: 64 + insets.bottom` and `paddingBottom: insets.bottom + 6`.
- **Use `navigation.replace()` not `navigation.navigate()` for the session flow** — `SessionActive → SessionComplete` must use `replace` so back button cannot return to a broken timer state.
- **Capture `activeSession` fields before calling `logSession()`** — `logSession` sets `activeSession: null`. Capture `subjectId`, `startedAt`, and `backendSessionId` into locals first.
- **Session API flow: start → complete, never POST /sessions** — `POST /sessions` does not exist. Flow: (1) `POST /sessions/start` → get `backendSessionId`, (2) `POST /sessions/:id/complete` with `durationSeconds`.
- **Pomodoro breaks never create sessions** — only `currentPhase === 'focus'` calls `startSession`; break phases run the timer only.

## Known Issues & Workarounds

- **`expo-crypto` enum name:** In SDK 54 use `CryptoEncoding.BASE64`, not `EncodingType.Base64`.
- **`studytrack://` scheme not intercepted in Expo Go:** Use `exp://192.168.0.106:8081` as `redirectTo`.

## Next Steps

- Deploy backend to Railway or Fly.io; update `EXPO_PUBLIC_API_URL` to production URL
- Build APK, Play Store submission
- Remote push notifications deferred to dev build / APK phase (local notifications only in Expo Go)

---

⚠️ **MODIFY THIS FILE** whenever any of the following happen:
- A new screen is added
- A new package is installed
- Navigation structure changes
- A new store or store action is added
- Auth flow changes
- A known issue is discovered or resolved
- A new environment variable is added
- Any critical rule is established during a session
