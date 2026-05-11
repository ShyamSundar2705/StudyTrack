# Batch 2 Design — P2-3 Recurring Tasks + P2-4 Planner Overflow Menu

**Date:** 2026-05-11  
**Scope:** DailyPlannerScreen, TaskFormSheet, new PlannerActionSheet, backend Task model

---

## Features

| ID | Feature | Files changed |
|---|---|---|
| P2-3 | Recurring Tasks | `schema.prisma`, `tasks.ts`, `tasks.controller.ts`, `TaskFormSheet.jsx`, `DailyPlannerScreen.jsx`, `dateTime.js` |
| P2-4 | Planner Overflow Menu | `DailyPlannerScreen.jsx`, new `PlannerActionSheet.jsx` |

---

## P2-3 — Recurring Tasks

### Data model

Add two things to `prisma/schema.prisma`:

**Fields on `Task`:**
```
isRecurring   Boolean  @default(false)
recurringDays Int[]
```

**New model `RecurringTaskCompletion`:**
```
model RecurringTaskCompletion {
  id          String   @id @default(cuid())
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date        String   // YYYY-MM-DD
  completedAt DateTime @default(now())
  @@unique([taskId, date])
}
```

Back-relations:
- `Task`: add `completions RecurringTaskCompletion[]`
- `User`: add `recurringCompletions RecurringTaskCompletion[]`

Run `npx prisma db push` after schema changes.

### Backend: `GET /tasks?date=YYYY-MM-DD`

Return union of:
1. Non-recurring tasks where `dueDate` falls on the requested date (existing behaviour)
2. Recurring tasks where `isRecurring = true` AND day-of-week of the requested date is in `recurringDays`

For recurring tasks, look up `RecurringTaskCompletion` for that date and attach:
- `completedOnDate: boolean`
- `completedAtOnDate: string | null`

Use `new Date(`${date}T12:00:00.000Z`).getDay()` to compute weekday (noon UTC avoids DST edge cases).

### Backend: `POST /tasks`

Accept new optional fields in body schema:
- `estimatedMinutes: integer | null`
- `isRecurring: boolean`
- `recurringDays: array of integer`

### Backend: `PATCH /tasks/:id`

Accept new optional fields in body schema:
- `date: string` (YYYY-MM-DD — required for recurring completions)
- `isRecurring: boolean`
- `recurringDays: array of integer`

Logic: when `completed` is present and the existing task has `isRecurring = true`, do NOT update `task.completed`. Instead:
- `completed: true` → upsert `RecurringTaskCompletion { taskId, userId, date }`
- `completed: false` → deleteMany `RecurringTaskCompletion` where `{ taskId, date }`

Return the base task record (unchanged `completed` field).

### Frontend: `src/utils/dateTime.js`

Add `formatRecurringLabel(days: number[]): string`:
- `[]` → `''`
- all 7 → `'Every day'`
- `[1,2,3,4,5]` → `'Weekdays'`
- `[0,6]` → `'Weekends'`
- single day → `'Every Mon'` etc.
- otherwise → `'Mon, Wed, Fri'` etc.

### Frontend: `TaskFormSheet.jsx`

New state:
```js
const [isRecurring, setIsRecurring] = useState(task?.isRecurring ?? false)
const [recurringDays, setRecurringDays] = useState(task?.recurringDays ?? [])
```

New UI below estimated-time chips:
- **Repeat toggle row** (52px, surface bg, 12px radius, 24px h-margin): left = repeat icon + "Repeat" label; right = `Switch` (accentPrimary when on)
- **Day-pill selector** (animated height 0→auto, visible when `isRecurring`): 7 circle pills (36px) labelled S M T W T F S; selected = accentPrimary bg + white bold text; unselected = surface bg + textSecondary text; 8px gap

Validation: if `isRecurring && recurringDays.length === 0` → show error "Select at least one day" and disable Save.

`handleSave` sends `isRecurring` and `recurringDays` (empty array when not recurring) to `POST /tasks`. Uses local-date arithmetic for `dueDate` (no `.toISOString()`).

### Frontend: `DailyPlannerScreen.jsx`

**`transformTask` additions** — pass through: `isRecurring`, `recurringDays`, `completedOnDate`, `subjectName` (subject.name or null), `createdAt`

**Task card additions:**
- Repeat icon (12px, accentLight) inline after task title when `isRecurring`
- Frequency label (11px, textSecondary) below title when `isRecurring` — calls `formatRecurringLabel`

**`handleToggleComplete` update:**
- For recurring tasks: toggle `completedOnDate`; send `{ completed, date: selectedDate }` to PATCH
- For non-recurring: existing behaviour (toggle `completed`, send `completedAt`)

---

## P2-4 — Planner Overflow Menu

### `src/components/PlannerActionSheet.jsx` (new file)

Same Modal + Animated slide-up pattern as `SessionActionSheet`. No new libraries.

Props: `visible`, `onClose`, `onAddTask`, `onAddEvent`, `onSortBySubject`, `onSortByTime`, `onClearCompleted`, `completedCount`, `currentSort`

Layout (top to bottom):
- Handle bar
- Section label "TASKS"
- Row: Add Task (add-circle-outline, accentLight)
- Row: Sort by Subject (color-filter-outline) — checkmark right if `currentSort === 'subject'`
- Row: Sort by Time Added (time-outline) — checkmark right if `currentSort === 'time'`
- Divider (0.5px, border color)
- Row: Clear Completed `(n)` — only when `completedCount > 0`; danger color, 5% danger bg
- Divider
- Section label "EVENTS"
- Row: Add Event (calendar-outline, accentLight)
- Cancel button (surfaceDeep bg, 52px, 24px side margin, 12px top margin)

### `DailyPlannerScreen.jsx` updates

- Replace `calendar-plus-outline` header icon with `ellipsis-vertical`; `onPress` → `setShowPlannerSheet(true)`
- New state: `showPlannerSheet` (boolean), `taskSort` ('default' | 'subject' | 'time')
- `sortedTasks` via `useMemo`:
  - `'subject'` → sort by `subjectName` (nulls last)
  - `'time'` → sort by `createdAt` ascending
  - `'default'` → incomplete first, completed last (uses `completedOnDate` for recurring)
- `completedCount` = tasks where (`isRecurring ? completedOnDate : completed`) is true
- `handleClearCompleted`: deletes only non-recurring completed tasks (recurring tasks are templates — only their completion records for that day are affected, but the task itself remains); optimistic remove from local state
- Mount `<PlannerActionSheet>` at bottom of render

---

## Corrections vs. original spec

| Spec snippet | Issue | Fix |
|---|---|---|
| `selectedDate.toISOString().split('T')[0]` | `selectedDate` is a string, not Date | Use `selectedDate` directly |
| `/api/tasks/${t.id}` | client baseURL already includes `/api` | Use `/tasks/${t.id}` |
| Missing `subjectName`, `createdAt` in transformTask | Subject sort + time sort need these fields | Add to transformTask return |
