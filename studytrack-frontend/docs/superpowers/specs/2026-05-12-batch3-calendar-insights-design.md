# Batch 3 Design — P2-5 Calendar Sync + P2-6 Insights Period Toggle

**Date:** 2026-05-12
**Scope:** DailyPlannerScreen, InsightsScreen, new calendarSync utility, backend getInsights reshape

---

## Features

| ID | Feature | Files changed |
|---|---|---|
| P2-5 | Calendar Sync | `src/utils/calendarSync.js` (new), `DailyPlannerScreen.jsx` |
| P2-6 | Insights Period Toggle | `users.controller.ts`, `InsightsScreen.jsx` |

---

## P2-5 — Calendar Sync

### Overview

Device calendar events are fetched locally via `expo-calendar` and merged with DB schedule events in the UI. No new backend endpoints. Events are read-only — never written back to the DB.

### Package

`expo-calendar` must be installed via `npx expo install expo-calendar`.

### `src/utils/calendarSync.js`

Exports:

```js
requestCalendarPermission() → Promise<boolean>
isCalendarSyncEnabled()     → Promise<boolean>     // reads AsyncStorage
setCalendarSyncEnabled(bool) → Promise<void>        // writes AsyncStorage

getDeviceCalendarEvents(dateISO: string) → Promise<DeviceEvent[]>
```

Storage key: `'calendar_sync_enabled'`

**Normalized device event shape:**
```js
{
  id: `device_${event.id}`,
  title: event.title ?? 'Untitled Event',
  startTime: 'HH:MM',          // local time, zero-padded
  endTime:   'HH:MM',          // local time, zero-padded — used for time range display
  durationMinutes: number,      // Math.round((endDate - startDate) / 60000)
  isDeviceEvent: true,
  calendarName: string,         // calendar.title or 'Calendar'
  color: string,                // event.color ?? '#4A90E2'
  notes: string | null,
}
```

`getDeviceCalendarEvents` checks permission first; returns `[]` if not granted. Fetches all user calendars, queries events for the full day (00:00:00–23:59:59 local), maps to the normalized shape. Errors are caught and logged; returns `[]` on failure.

### `DailyPlannerScreen.jsx` changes

**New state:**
```js
const [calendarEnabled, setCalendarEnabled] = useState(false)
const [deviceEvents,    setDeviceEvents]    = useState([])
```

**Mount effect** — reads saved preference and loads events if previously enabled:
```js
useEffect(() => {
  isCalendarSyncEnabled().then(enabled => {
    setCalendarEnabled(enabled)
    if (enabled) loadDeviceEvents(selectedDate)
  })
}, [])
```

**Date-change effect** — reloads when date or enabled state changes:
```js
useEffect(() => {
  if (calendarEnabled) loadDeviceEvents(selectedDate)
}, [selectedDate, calendarEnabled])
```

**Toggle handler:**
```js
const handleCalendarSyncToggle = async () => {
  if (calendarEnabled) {
    setCalendarEnabled(false)
    setDeviceEvents([])
    await setCalendarSyncEnabled(false)
    return
  }
  const granted = await requestCalendarPermission()
  if (!granted) {
    Alert.alert('Calendar Access Required',
      'Please allow calendar access in your device settings to sync events.',
      [{ text: 'OK' }])
    return
  }
  setCalendarEnabled(true)
  await setCalendarSyncEnabled(true)
  await loadDeviceEvents(selectedDate)
}
```

**Merged events (useMemo):**
```js
const allEvents = useMemo(() =>
  [...events, ...deviceEvents].sort((a, b) => a.startTime.localeCompare(b.startTime)),
  [events, deviceEvents]
)
```
Replace `events` with `allEvents` in the schedule section render.

**Sync button** — placed in the Schedule section header (right side, next to section title):
```
calendarEnabled === false → "Sync calendar"  (accentLight, 13px)
calendarEnabled === true  → "Synced ✓"       (success color, 13px)
```

**Device event card** (when `event.isDeviceEvent === true`):
- Background: `colors.surfaceBlue` (`#0D1526`)
- Border: 0.5px `colors.accentPrimary`
- Left accent bar: `event.color`
- `calendar-outline` icon (12px, `accentLight`) in top-right corner of card
- Displays `startTime – endTime` as the time range
- NOT tappable for editing; onPress shows:
  ```
  Alert: "This event is from your device calendar and cannot be edited here."
  ```

---

## P2-6 — Insights Period Toggle

### Backend: reshape `GET /api/users/me/insights`

**Period values supported:** `'week'`, `'month'`, `'allTime'` (also accept legacy `'all'` as alias for `'allTime'`)

**Date ranges:**
- `week` → last 7 days inclusive of today
- `month` → last 30 days inclusive of today
- `allTime` / `all` → all sessions ever

**New response shape:**
```ts
{
  totalSeconds: number,
  dailyAverageSeconds: number,   // totalSeconds / daysWithSessions (0 if no sessions)
  bestDaySeconds: number,         // max single-day total in period
  heatmap: { date: string, seconds: number }[],   // flat array, size = 7 / 30 / 365
  bySubject: {
    subjectId: string,
    name: string,
    colorHex: string,
    seconds: number,
    percentage: number,           // (subject_seconds / totalSeconds) * 100, rounded
  }[],                            // sorted by seconds desc
  dailyBreakdown: { date: string, seconds: number }[],  // 7 / 30 / 12 entries
  streak: number,
  totalSessions: number,
}
```

**Heatmap sizes:**
- `week` → 7 entries (today − 6 through today)
- `month` → 30 entries (today − 29 through today)
- `allTime` → 365 entries (today − 364 through today)

**dailyBreakdown sizes:**
- `week` → 7 entries, one per day (today − 6 through today)
- `month` → 30 entries, one per day (today − 29 through today)
- `allTime` → 12 entries, aggregated by calendar month (oldest → newest), `date` field = first day of that month (`YYYY-MM-01`)

**Remove:** `buildHeatmapGrid`, `fmtSeconds` from the insights function (keep `fmtSeconds` if used elsewhere). The frontend now does all formatting.

### Frontend: `InsightsScreen.jsx`

**Period state:** `'week' | 'month' | 'allTime'` (string), initially `'week'`.
`PERIOD_KEYS = ['week', 'month', 'allTime']` — replaces current `['week', 'month', 'all']`.

**Data fetching:**
```js
useFocusEffect(
  useCallback(() => { fetchInsights(period) }, [period])
)
```
Reason: re-fetches when navigating back from `SubjectDetails` so breakdown stays current.

**Three render states (mutually exclusive):**

1. **Loading skeleton** — while `isLoading`: pulsing gray rectangles via `Animated` opacity loop (0.3 → 0.7, 800ms), placed where stats cards / heatmap / bar chart / subject rows would be.

2. **Error state** — `alert-circle-outline` (32px, danger), "Failed to load insights" (15px, white), "Try again" (accentPrimary, tappable → calls `fetchInsights(period)`).

3. **Empty state** — when `insightsData?.totalSeconds === 0`: `book-open` icon (40px, border color), "No study data yet" (15px, white), "Start a session to see your insights" (13px, textSecondary).

**Hero stats** (when data present):
```
formatDuration(insightsData.totalSeconds)
formatDuration(insightsData.dailyAverageSeconds)
formatDuration(insightsData.bestDaySeconds)
```
Period sublabel: `week → "This week"`, `month → "This month"`, `allTime → "All time"`.

**Heatmap rendering per period:**

Cell color from seconds:
```
0       → '#1A1A1A'
< 3600  → '#1A2744'
< 7200  → '#1E3A6E'
< 14400 → '#2D6BE4'
< 21600 → '#4A90E2'
≥ 21600 → '#7AB3F0'
```
Today's cell: 1.5px white border ring.

- `week`: single row of 7 cells.
- `month`: 5×6 grid (30 cells, 6 columns × 5 rows).
- `allTime`: 7 rows × 53 columns inside `<ScrollView horizontal>`. Backend sends 365 entries; pad to 371 (next multiple of 7) with `{ date: '', seconds: 0 }` at the start so column 0 aligns to the correct weekday. Cells with empty date are rendered as transparent/empty.

Heatmap section title:
- `week` → "This Week"
- `month` → current "MMM YYYY" (e.g. "May 2026")
- `allTime` → "All Time"

Remove the month-navigation chevrons (only relevant for calendar-month view, not used here).

**Bar chart:**
Bar height % = `entry.seconds / maxSeconds * 100` (maxSeconds = max across all entries in breakdown, minimum 1).
Today's bar: `colors.accentLight`. Other bars: `colors.accentPrimary`. Zero bars: `colors.surface` (empty track).

Labels:
- `week` → 3-letter weekday initials: Mon Tue Wed Thu Fri Sat Sun
- `month` → show date number every 5th entry, empty string otherwise
- `allTime` → 3-letter month name: Jan Feb Mar...

**Subject breakdown:**
Map `insightsData.bySubject`, show max 5 rows. Color dot from `subject.colorHex`. Hours: `formatDuration(subject.seconds)`. Percentage: `subject.percentage.toFixed(0) + '%'`. Bar fill: `subject.percentage + '%'`.
If `bySubject.length > 5`: "See all subjects →" link (accentLight, 13px) — navigates to a filtered subject list (no new screen needed; can be a no-op or navigate to Insights with a filter flag — leave as no-op for now).

---

## Corrections vs. batch3_calendar_insights.md

| Spec snippet | Issue | Fix |
|---|---|---|
| `allTime` heatmap "52 columns" = 364 cells | Misses today | Use 365 entries (7×53=371, pad with empties) |
| `fetchInsights` uses `useEffect` | Won't re-fetch on back-nav from SubjectDetails | Use `useFocusEffect(useCallback(..., [period]))` |
| `endTime` missing from spec's device event object | Card needs it for time-range display | Add `endTime: 'HH:MM'` to normalized shape |
| Batch3 spec calls `/api/users/me/insights` | baseURL already includes `/api` | Use `/users/me/insights` (already correct in `users.js`) |
| `month` range is calendar-month in backend | Spec wants last 30 days | Change to `today - 29 days` |
| `all` period key | Spec uses `allTime`, frontend uses `all` | Support both in backend; use `allTime` in frontend |
