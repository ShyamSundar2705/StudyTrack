# Batch 2 — Recurring Tasks + Planner Overflow Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recurring task support (weekly repeat schedule, per-day completion tracking) and a 3-dot overflow menu to the DailyPlannerScreen (sort, clear, add shortcuts).

**Architecture:** Backend adds `isRecurring`/`recurringDays` to `Task` and a new `RecurringTaskCompletion` join model; the `GET /tasks` endpoint returns a union of date-specific and recurring tasks; `PATCH /tasks/:id` routes recurring completions to that join model. Frontend extends `TaskFormSheet` with a repeat toggle + animated day-pill selector, adds `PlannerActionSheet` as a new bottom-sheet component, and wires sorting/clearing/header into `DailyPlannerScreen`.

**Tech Stack:** Prisma 7 (PostgreSQL), Fastify v5, TypeScript (backend); React Native + Expo, Zustand, Animated API (frontend)

---

## File Map

| Action | Path |
|---|---|
| Modify | `studytrack-backend/prisma/schema.prisma` |
| Modify | `studytrack-backend/src/routes/tasks.ts` |
| Modify | `studytrack-backend/src/controllers/tasks.controller.ts` |
| Modify | `studytrack-frontend/src/utils/dateTime.js` |
| Modify | `studytrack-frontend/src/components/TaskFormSheet.jsx` |
| Create | `studytrack-frontend/src/components/PlannerActionSheet.jsx` |
| Modify | `studytrack-frontend/src/screens/DailyPlannerScreen.jsx` |
| Modify | `studytrack-backend/CLAUDE.md` |
| Modify | `studytrack-frontend/CLAUDE.md` |

---

## Task 1: Prisma Schema — Recurring Task Fields + Completion Model

**Files:**
- Modify: `studytrack-backend/prisma/schema.prisma`

- [ ] **Step 1: Add `isRecurring` and `recurringDays` to the Task model**

  Open `studytrack-backend/prisma/schema.prisma`. The current `Task` model ends at `carriedOver`. Add two fields and the completions back-relation:

  ```prisma
  model Task {
    id               String    @id @default(cuid())
    userId           String
    title            String
    subjectId        String?
    dueDate          DateTime?
    completed        Boolean   @default(false)
    completedAt      DateTime?
    carriedOver      Boolean   @default(false)
    estimatedMinutes Int?
    isRecurring      Boolean   @default(false)
    recurringDays    Int[]
    createdAt        DateTime  @default(now())
    user             User      @relation(fields: [userId], references: [id])
    subject          Subject?  @relation(fields: [subjectId], references: [id])
    completions      RecurringTaskCompletion[]
  }
  ```

- [ ] **Step 2: Add the RecurringTaskCompletion model**

  Append after the `Task` model block (before `Achievement`):

  ```prisma
  model RecurringTaskCompletion {
    id          String   @id @default(cuid())
    taskId      String
    task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
    userId      String
    user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    date        String
    completedAt DateTime @default(now())

    @@unique([taskId, date])
  }
  ```

- [ ] **Step 3: Add back-relations on User**

  In the `User` model, add:
  ```prisma
  recurringCompletions RecurringTaskCompletion[]
  ```
  Place it after the existing `scheduleEvents ScheduleEvent[]` line.

- [ ] **Step 4: Push schema and regenerate client**

  Make sure `npx prisma dev` is running in a separate terminal first, then:

  ```bash
  cd studytrack-backend
  npx prisma db push
  npx prisma generate
  ```

  Expected: `Your database is now in sync with your Prisma schema.` and client regenerated in `generated/prisma/`.

- [ ] **Step 5: Commit**

  ```bash
  git add studytrack-backend/prisma/schema.prisma
  git commit -m "feat: add isRecurring, recurringDays to Task and RecurringTaskCompletion model"
  ```

---

## Task 2: Backend Routes — Update Task Body Schemas

**Files:**
- Modify: `studytrack-backend/src/routes/tasks.ts`

- [ ] **Step 1: Update POST /tasks body schema**

  Replace the existing `fastify.post('/tasks', ...)` block with:

  ```typescript
  fastify.post('/tasks', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1 },
          subjectId: { type: 'string' },
          dueDate: { type: 'string' },
          estimatedMinutes: { type: 'integer' },
          isRecurring: { type: 'boolean' },
          recurringDays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
        }
      }
    }
  }, createTask)
  ```

- [ ] **Step 2: Update PATCH /tasks/:id body schema**

  Replace the existing `fastify.patch('/tasks/:id', ...)` block with:

  ```typescript
  fastify.patch('/tasks/:id', {
    preHandler: authenticate,
    schema: {
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          subjectId: { type: ['string', 'null'] },
          estimatedMinutes: { type: ['integer', 'null'] },
          completed: { type: 'boolean' },
          completedAt: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}' },
          carriedOver: { type: 'boolean' },
          dueDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}' },
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}' },
          isRecurring: { type: 'boolean' },
          recurringDays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
        }
      }
    }
  }, updateTask)
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add studytrack-backend/src/routes/tasks.ts
  git commit -m "feat: add recurring fields and date param to task route schemas"
  ```

---

## Task 3: Backend Controller — listTasks with Recurring Support

**Files:**
- Modify: `studytrack-backend/src/controllers/tasks.controller.ts`

- [ ] **Step 1: Replace the listTasks function**

  Replace the entire `listTasks` export with:

  ```typescript
  export async function listTasks(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id
    const { date } = request.query as { date?: string }
    const prisma = request.server.prisma

    if (!date) {
      const tasks = await prisma.task.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      return reply.send({ data: { tasks } })
    }

    // Day of week: use noon UTC to avoid DST edge cases (0=Sun…6=Sat)
    const dayOfWeek = new Date(`${date}T12:00:00.000Z`).getDay()

    const [dateTasks, recurringTasks] = await Promise.all([
      prisma.task.findMany({
        where: {
          userId,
          isRecurring: false,
          dueDate: {
            gte: new Date(`${date}T00:00:00.000Z`),
            lte: new Date(`${date}T23:59:59.999Z`),
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.task.findMany({
        where: {
          userId,
          isRecurring: true,
          recurringDays: { has: dayOfWeek },
        },
        include: {
          completions: { where: { date } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const recurringWithCompletion = recurringTasks.map((task) => {
      const completion = task.completions[0] ?? null
      const { completions, ...rest } = task
      return {
        ...rest,
        completedOnDate: completion !== null,
        completedAtOnDate: completion?.completedAt?.toISOString() ?? null,
      }
    })

    return reply.send({ data: { tasks: [...dateTasks, ...recurringWithCompletion] } })
  }
  ```

- [ ] **Step 2: Verify the server compiles and starts**

  ```bash
  cd studytrack-backend
  npm run dev
  ```

  Expected: server starts on port 3000 with no TypeScript errors.

- [ ] **Step 3: Manual test — GET /tasks?date=YYYY-MM-DD**

  Send a GET request (replace date with today's date and use your app JWT):
  ```
  GET http://192.168.0.106:3000/api/tasks?date=2026-05-11
  Authorization: Bearer <your_token>
  ```
  Expected: `{ data: { tasks: [...] } }` — no server crash.

- [ ] **Step 4: Commit**

  ```bash
  git add studytrack-backend/src/controllers/tasks.controller.ts
  git commit -m "feat: listTasks returns recurring tasks by day-of-week with completedOnDate"
  ```

---

## Task 4: Backend Controller — createTask + updateTask with Recurring

**Files:**
- Modify: `studytrack-backend/src/controllers/tasks.controller.ts`

- [ ] **Step 1: Replace the createTask function**

  ```typescript
  export async function createTask(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id
    const { title, subjectId, dueDate, estimatedMinutes, isRecurring, recurringDays } = request.body as {
      title: string
      subjectId?: string
      dueDate?: string
      estimatedMinutes?: number
      isRecurring?: boolean
      recurringDays?: number[]
    }

    const prisma = request.server.prisma
    const task = await prisma.task.create({
      data: {
        userId,
        title,
        subjectId,
        estimatedMinutes,
        isRecurring: isRecurring ?? false,
        recurringDays: recurringDays ?? [],
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      },
    })

    return reply.status(201).send({ data: { task } })
  }
  ```

- [ ] **Step 2: Replace the updateTask function**

  ```typescript
  export async function updateTask(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as { id: string }
    const body = request.body as {
      title?: string
      subjectId?: string | null
      estimatedMinutes?: number | null
      completed?: boolean
      completedAt?: string | null
      carriedOver?: boolean
      dueDate?: string
      date?: string
      isRecurring?: boolean
      recurringDays?: number[]
    }

    const prisma = request.server.prisma

    const existing = await prisma.task.findUnique({ where: { id: params.id } })
    if (!existing) return reply.status(404).send({ error: 'Task not found' })
    if (existing.userId !== request.user.id) return reply.status(403).send({ error: 'Forbidden' })

    // Recurring completion: upsert/delete RecurringTaskCompletion, never touch task.completed
    if (existing.isRecurring && body.completed !== undefined) {
      const dateStr = body.date
      if (!dateStr) return reply.status(400).send({ error: 'date is required for recurring task completion' })

      if (body.completed) {
        await prisma.recurringTaskCompletion.upsert({
          where: { taskId_date: { taskId: existing.id, date: dateStr } },
          create: { taskId: existing.id, userId: request.user.id, date: dateStr },
          update: {},
        })
      } else {
        await prisma.recurringTaskCompletion.deleteMany({
          where: { taskId: existing.id, date: dateStr },
        })
      }

      const task = await prisma.task.findUnique({ where: { id: params.id } })
      return reply.send({ data: { task } })
    }

    // Non-recurring update (or editing recurring task metadata)
    const dateUpdates: Record<string, Date | null> = {}
    if (body.completed !== undefined) {
      dateUpdates.completedAt = body.completed
        ? (body.completedAt ? new Date(body.completedAt) : new Date())
        : null
    } else if (body.completedAt !== undefined) {
      dateUpdates.completedAt = body.completedAt ? new Date(body.completedAt) : null
    }

    const task = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.subjectId !== undefined && { subjectId: body.subjectId }),
        ...(body.estimatedMinutes !== undefined && { estimatedMinutes: body.estimatedMinutes }),
        ...(body.completed !== undefined && { completed: body.completed }),
        ...('completedAt' in dateUpdates && { completedAt: dateUpdates.completedAt }),
        ...(body.carriedOver !== undefined && { carriedOver: body.carriedOver }),
        ...(body.dueDate !== undefined && { dueDate: new Date(body.dueDate) }),
        ...(body.isRecurring !== undefined && { isRecurring: body.isRecurring }),
        ...(body.recurringDays !== undefined && { recurringDays: body.recurringDays }),
      },
    })

    return reply.send({ data: { task } })
  }
  ```

- [ ] **Step 3: Restart server and verify no errors**

  ```bash
  # Stop existing server (Ctrl+C), then:
  npm run dev
  ```

  Expected: clean start, no TypeScript errors.

- [ ] **Step 4: Manual test — create a recurring task**

  ```
  POST http://192.168.0.106:3000/api/tasks
  Authorization: Bearer <token>
  Content-Type: application/json

  { "title": "Morning review", "isRecurring": true, "recurringDays": [1, 3, 5] }
  ```

  Expected: 201 with `{ data: { task: { id, isRecurring: true, recurringDays: [1,3,5], ... } } }`

- [ ] **Step 5: Manual test — mark recurring task complete for a date**

  Use the task ID from Step 4:
  ```
  PATCH http://192.168.0.106:3000/api/tasks/<id>
  Authorization: Bearer <token>
  Content-Type: application/json

  { "completed": true, "date": "2026-05-12" }
  ```

  Expected: 200, task returned with `completed: false` (base task unchanged).
  Then verify: `GET /tasks?date=2026-05-12` returns the task with `completedOnDate: true`.

- [ ] **Step 6: Commit**

  ```bash
  git add studytrack-backend/src/controllers/tasks.controller.ts
  git commit -m "feat: createTask accepts recurring fields; updateTask handles per-day completion"
  ```

---

## Task 5: Frontend — formatRecurringLabel Utility

**Files:**
- Modify: `studytrack-frontend/src/utils/dateTime.js`

- [ ] **Step 1: Add formatRecurringLabel to dateTime.js**

  Append to the end of `studytrack-frontend/src/utils/dateTime.js`:

  ```javascript
  export function formatRecurringLabel(days) {
    if (!days?.length) return ''
    const sorted = [...days].sort((a, b) => a - b)
    if (sorted.length === 7) return 'Every day'
    if (sorted.join(',') === '1,2,3,4,5') return 'Weekdays'
    if (sorted.join(',') === '0,6') return 'Weekends'
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    if (sorted.length === 1) return `Every ${names[sorted[0]]}`
    return sorted.map(d => names[d]).join(', ')
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add studytrack-frontend/src/utils/dateTime.js
  git commit -m "feat: add formatRecurringLabel utility for recurring task frequency display"
  ```

---

## Task 6: Frontend — TaskFormSheet Recurring UI

**Files:**
- Modify: `studytrack-frontend/src/components/TaskFormSheet.jsx`

- [ ] **Step 1: Add Switch and Animated imports**

  Update the React Native import line to include `Switch` and `Animated`:

  ```javascript
  import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ScrollView, Animated, Switch, Keyboard, KeyboardAvoidingView,
    Platform, StyleSheet
  } from 'react-native'
  ```

- [ ] **Step 2: Add recurring state and animation ref**

  After `const [error, setError] = useState(null)`, add:

  ```javascript
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringDays, setRecurringDays] = useState([])
  const dayPillAnim = useRef(new Animated.Value(0)).current
  ```

- [ ] **Step 3: Reset recurring state when sheet opens**

  Update the `useEffect` that runs when `visible` changes. Replace the existing `useEffect` block entirely:

  ```javascript
  useEffect(() => {
    if (visible) {
      setTitle(task?.title ?? '')
      setSubjectId(task?.subjectId ?? null)
      setEstimatedMinutes(task?.estimatedMinutes ?? null)
      setIsRecurring(task?.isRecurring ?? false)
      setRecurringDays(task?.recurringDays ?? [])
      dayPillAnim.setValue(task?.isRecurring ? 1 : 0)
      setError(null)
      setIsSubmitting(false)
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start()
    } else {
      slideAnim.setValue(400)
    }
  }, [visible])
  ```

- [ ] **Step 4: Add toggleRecurring and toggleDay helpers**

  After `handleClose`, add:

  ```javascript
  const toggleRecurring = (val) => {
    setIsRecurring(val)
    if (!val) setRecurringDays([])
    Animated.timing(dayPillAnim, {
      toValue: val ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }

  const toggleDay = (dayIndex) => {
    setRecurringDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    )
  }
  ```

- [ ] **Step 5: Update canSave validation**

  Replace the existing `const canSave` line:

  ```javascript
  const hasRecurringError = isRecurring && recurringDays.length === 0
  const canSave = title.trim().length > 0 && !isSubmitting && !hasRecurringError
  ```

- [ ] **Step 6: Update handleSave to include recurring fields**

  In `handleSave`, replace both the POST and PATCH API calls:

  For POST (new task):
  ```javascript
  const res = await api.post('/tasks', {
    title: title.trim(),
    subjectId: subjectId || null,
    estimatedMinutes: estimatedMinutes || null,
    dueDate: `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`,
    isRecurring,
    recurringDays: isRecurring ? recurringDays : [],
  })
  ```

  For PATCH (edit existing):
  ```javascript
  const res = await api.patch(`/tasks/${task.id}`, {
    title: title.trim(),
    subjectId: subjectId || null,
    estimatedMinutes: estimatedMinutes || null,
    isRecurring,
    recurringDays: isRecurring ? recurringDays : [],
  })
  ```

- [ ] **Step 7: Add repeat toggle row and day pills to JSX**

  After the closing `</ScrollView>` of the estimated time chips section (before `{error ? ...}`), insert:

  ```jsx
  {/* Repeat toggle row */}
  <View style={styles.repeatRow}>
    <View style={styles.repeatLeft}>
      <Ionicons name="repeat-outline" size={18} color={colors.accentLight} />
      <Text style={styles.repeatLabel}>Repeat</Text>
    </View>
    <Switch
      value={isRecurring}
      onValueChange={toggleRecurring}
      trackColor={{ false: colors.border, true: colors.accentPrimary }}
      thumbColor="#FFFFFF"
    />
  </View>

  {/* Day pill selector — animated expand */}
  <Animated.View style={{
    maxHeight: dayPillAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }),
    opacity: dayPillAnim,
    overflow: 'hidden',
    marginTop: spacing.md,
  }}>
    <View style={styles.dayPillsRow}>
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => {
        const selected = recurringDays.includes(index)
        return (
          <TouchableOpacity
            key={index}
            style={[styles.dayPill, selected && styles.dayPillSelected]}
            onPress={() => toggleDay(index)}
          >
            <Text style={[styles.dayPillText, selected && styles.dayPillTextSelected]}>
              {label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  </Animated.View>

  {/* Recurring validation error */}
  {hasRecurringError && (
    <Text style={styles.recurringError}>Select at least one day</Text>
  )}
  ```

- [ ] **Step 8: Add new styles**

  Add to the `StyleSheet.create({})` object:

  ```javascript
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.lg,
  },
  repeatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  repeatLabel: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  dayPillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.xxl,
  },
  dayPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dayPillSelected: {
    backgroundColor: colors.accentPrimary,
  },
  dayPillText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dayPillTextSelected: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  recurringError: {
    fontSize: 12,
    color: colors.danger,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.xs,
  },
  ```

- [ ] **Step 9: Commit**

  ```bash
  git add studytrack-frontend/src/components/TaskFormSheet.jsx
  git commit -m "feat: add repeat toggle and day-pill selector to TaskFormSheet"
  ```

---

## Task 7: Frontend — DailyPlannerScreen transformTask + Task Card Recurring Badge

**Files:**
- Modify: `studytrack-frontend/src/screens/DailyPlannerScreen.jsx`

- [ ] **Step 1: Add formatRecurringLabel import**

  At the top of `DailyPlannerScreen.jsx`, add to imports:

  ```javascript
  import { formatRecurringLabel } from '../utils/dateTime';
  ```

- [ ] **Step 2: Replace transformTask to include recurring fields**

  Replace the existing `transformTask` function entirely:

  ```javascript
  function transformTask(task, subjects) {
    const now = new Date()
    const effectiveCompleted = task.isRecurring ? task.completedOnDate : task.completed
    let status = 'pending'
    let overdue = false
    if (effectiveCompleted) {
      status = 'done'
    } else if (!task.isRecurring && task.dueDate && new Date(task.dueDate) < now) {
      status = 'overdue'
      overdue = true
    }
    const subject = subjects.find((s) => s.id === task.subjectId)
    const tags = subject ? [{ label: subject.name, color: subject.color }] : []
    const accentColor = status === 'overdue' ? colors.danger : null
    return {
      id: task.id,
      title: task.title,
      status,
      tags,
      accentColor,
      overdue,
      completed: task.completed,
      completedOnDate: task.completedOnDate ?? false,
      subjectId: task.subjectId,
      subjectName: subject?.name ?? null,
      isRecurring: task.isRecurring ?? false,
      recurringDays: task.recurringDays ?? [],
      createdAt: task.createdAt,
    }
  }
  ```

- [ ] **Step 3: Update the task card body inside SwipeableTaskRow**

  Inside `SwipeableTaskRow`, find the `<View style={styles.taskBody}>` block. Replace it with:

  ```jsx
  <View style={styles.taskBody}>
    <View style={styles.taskTitleRow}>
      <Text style={[styles.taskTitle, task.status === 'done' && styles.taskTitleDone]}>
        {task.title}
      </Text>
      {task.isRecurring && (
        <Ionicons name="repeat-outline" size={12} color={colors.accentLight} />
      )}
    </View>
    {task.isRecurring && task.recurringDays?.length > 0 && (
      <Text style={styles.recurringLabel}>
        {formatRecurringLabel(task.recurringDays)}
      </Text>
    )}
    <View style={styles.taskTags}>
      {task.tags.map((tag) => (
        <View key={tag.label} style={[styles.tag, { borderColor: tag.color }]}>
          <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
        </View>
      ))}
      {task.overdue && <Text style={styles.overdueLabel}>OVERDUE</Text>}
    </View>
  </View>
  ```

- [ ] **Step 4: Add the two new styles**

  In the `StyleSheet.create` block, add:

  ```javascript
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recurringLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add studytrack-frontend/src/screens/DailyPlannerScreen.jsx
  git commit -m "feat: transformTask includes recurring fields; task card shows repeat icon and frequency label"
  ```

---

## Task 8: Frontend — PlannerActionSheet Component

**Files:**
- Create: `studytrack-frontend/src/components/PlannerActionSheet.jsx`

- [ ] **Step 1: Create the file**

  Create `studytrack-frontend/src/components/PlannerActionSheet.jsx` with this full content:

  ```jsx
  import React, { useRef, useEffect } from 'react'
  import {
    Modal, View, Text, TouchableOpacity, Animated, StyleSheet,
  } from 'react-native'
  import { Ionicons } from '@expo/vector-icons'
  import { colors, spacing, radius } from '../constraints/theme'

  function ActionRow({ icon, label, showChevron, checkmark, danger, onPress }) {
    return (
      <TouchableOpacity
        style={[styles.row, danger && styles.rowDanger]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.danger : colors.accentLight}
          style={styles.rowIcon}
        />
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {checkmark && (
          <Ionicons name="checkmark" size={18} color={colors.accentPrimary} />
        )}
        {showChevron && !checkmark && (
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    )
  }

  export default function PlannerActionSheet({
    visible,
    onClose,
    onAddTask,
    onAddEvent,
    onSortBySubject,
    onSortByTime,
    onClearCompleted,
    completedCount,
    currentSort,
  }) {
    const slideAnim = useRef(new Animated.Value(400)).current

    useEffect(() => {
      if (visible) {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start()
      } else {
        slideAnim.setValue(400)
      }
    }, [visible])

    const handleClose = () => {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 200,
        useNativeDriver: true,
      }).start(onClose)
    }

    return (
      <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          <Text style={styles.sectionLabel}>Tasks</Text>

          <ActionRow
            icon="add-circle-outline"
            label="Add Task"
            showChevron
            onPress={onAddTask}
          />
          <ActionRow
            icon="color-filter-outline"
            label="Sort by Subject"
            checkmark={currentSort === 'subject'}
            onPress={onSortBySubject}
          />
          <ActionRow
            icon="time-outline"
            label="Sort by Time Added"
            checkmark={currentSort === 'time'}
            onPress={onSortByTime}
          />

          {completedCount > 0 && (
            <>
              <View style={styles.divider} />
              <ActionRow
                icon="checkmark-done-outline"
                label={`Clear Completed (${completedCount})`}
                danger
                onPress={onClearCompleted}
              />
            </>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Events</Text>

          <ActionRow
            icon="calendar-outline"
            label="Add Event"
            showChevron
            onPress={onAddEvent}
          />

          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    )
  }

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    handleContainer: {
      alignItems: 'center',
      paddingTop: spacing.md,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
    },
    sectionLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginLeft: spacing.xxl,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 52,
      paddingHorizontal: spacing.xxl,
    },
    rowDanger: {
      backgroundColor: 'rgba(231, 76, 60, 0.05)',
    },
    rowIcon: {
      marginRight: spacing.lg,
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
    },
    rowLabelDanger: {
      color: colors.danger,
    },
    divider: {
      height: 0.5,
      backgroundColor: colors.border,
      marginHorizontal: spacing.xxl,
    },
    cancelBtn: {
      backgroundColor: colors.surfaceDeep,
      borderRadius: radius.md,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: spacing.xxl,
      marginTop: spacing.md,
      marginBottom: spacing.xxl,
    },
    cancelText: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '500',
    },
  })
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add studytrack-frontend/src/components/PlannerActionSheet.jsx
  git commit -m "feat: create PlannerActionSheet bottom-sheet component"
  ```

---

## Task 9: Frontend — DailyPlannerScreen Wire Overflow Menu + Sorting + handleToggleComplete

**Files:**
- Modify: `studytrack-frontend/src/screens/DailyPlannerScreen.jsx`

- [ ] **Step 1: Update React import to include useMemo**

  Replace the first line:

  ```javascript
  import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
  ```

- [ ] **Step 2: Import PlannerActionSheet**

  After the `ScheduleEventFormSheet` import line, add:

  ```javascript
  import PlannerActionSheet from '../components/PlannerActionSheet';
  ```

- [ ] **Step 3: Add showPlannerSheet and taskSort state**

  After the existing `const [editingEvent, setEditingEvent] = useState(null)` line, add:

  ```javascript
  const [showPlannerSheet, setShowPlannerSheet] = useState(false);
  const [taskSort, setTaskSort] = useState('default');
  ```

- [ ] **Step 4: Add sortedTasks memo and completedCount**

  After the `fetchForDate` function definition, add:

  ```javascript
  const sortedTasks = useMemo(() => {
    if (taskSort === 'subject') {
      return [...tasks].sort((a, b) => {
        const nameA = a.subjectName ?? 'zzz';
        const nameB = b.subjectName ?? 'zzz';
        return nameA.localeCompare(nameB);
      });
    }
    if (taskSort === 'time') {
      return [...tasks].sort((a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt)
      );
    }
    // default: incomplete first, completed last
    return [...tasks].sort((a, b) => {
      const aComplete = a.isRecurring ? a.completedOnDate : a.completed;
      const bComplete = b.isRecurring ? b.completedOnDate : b.completed;
      if (aComplete === bComplete) return 0;
      return aComplete ? 1 : -1;
    });
  }, [tasks, taskSort]);

  const completedCount = tasks.filter(t =>
    t.isRecurring ? t.completedOnDate : t.completed
  ).length;
  ```

- [ ] **Step 5: Replace handleToggleComplete to support recurring tasks**

  Replace the entire `handleToggleComplete` function:

  ```javascript
  const handleToggleComplete = async (task) => {
    const isCurrentlyDone = task.isRecurring ? task.completedOnDate : task.completed;
    const newCompleted = !isCurrentlyDone;

    setTasks((prev) => prev.map((t) =>
      t.id === task.id
        ? task.isRecurring
          ? { ...t, completedOnDate: newCompleted, status: newCompleted ? 'done' : 'pending' }
          : {
              ...t,
              status: newCompleted ? 'done' : 'pending',
              completed: newCompleted,
              accentColor: newCompleted ? null : t.accentColor,
              overdue: newCompleted ? false : t.overdue,
            }
        : t
    ));

    try {
      const body = task.isRecurring
        ? { completed: newCompleted, date: selectedDate }
        : {
            completed: newCompleted,
            completedAt: newCompleted ? new Date().toISOString() : null,
          };
      await api.patch(`/tasks/${task.id}`, body);
    } catch {
      fetchForDate(selectedDate);
    }
  };
  ```

- [ ] **Step 6: Add handleClearCompleted**

  After `handleToggleComplete`, add:

  ```javascript
  const handleClearCompleted = async () => {
    const toDelete = tasks.filter(t => !t.isRecurring && t.completed);
    setTasks((prev) => prev.filter(t => t.isRecurring ? true : !t.completed));
    try {
      await Promise.all(toDelete.map(t => api.delete(`/tasks/${t.id}`)));
    } catch {
      fetchForDate(selectedDate);
    }
  };
  ```

- [ ] **Step 7: Replace the header button (calendar-plus → ellipsis-vertical)**

  In the JSX header section, replace:

  ```jsx
  <TouchableOpacity
    style={styles.headerBtn}
    onPress={() => {
      setEditingEvent(null);
      setShowEventForm(true);
    }}
  >
    <Ionicons name="calendar-plus-outline" size={22} color={colors.textSecondary} />
  </TouchableOpacity>
  ```

  With:

  ```jsx
  <TouchableOpacity
    style={styles.headerBtn}
    onPress={() => setShowPlannerSheet(true)}
  >
    <Ionicons name="ellipsis-vertical" size={22} color={colors.textSecondary} />
  </TouchableOpacity>
  ```

- [ ] **Step 8: Replace tasks.map with sortedTasks.map in the task list**

  In the render section, find `tasks.map((task) => (` and replace with `sortedTasks.map((task) => (`.

  Also find `tasks.length === 0` in the empty state check and replace with `sortedTasks.length === 0`. (The section count can stay as `tasks.length`.)

- [ ] **Step 9: Mount PlannerActionSheet at the bottom of the return**

  After the closing `/>` of `<ScheduleEventFormSheet ... />` and before the final `</View>`, add:

  ```jsx
  <PlannerActionSheet
    visible={showPlannerSheet}
    onClose={() => setShowPlannerSheet(false)}
    onAddTask={() => {
      setShowPlannerSheet(false);
      setEditingTask(null);
      setShowTaskForm(true);
    }}
    onAddEvent={() => {
      setShowPlannerSheet(false);
      setEditingEvent(null);
      setShowEventForm(true);
    }}
    onSortBySubject={() => {
      setTaskSort(prev => prev === 'subject' ? 'default' : 'subject');
      setShowPlannerSheet(false);
    }}
    onSortByTime={() => {
      setTaskSort(prev => prev === 'time' ? 'default' : 'time');
      setShowPlannerSheet(false);
    }}
    onClearCompleted={() => {
      Alert.alert(
        'Clear completed tasks?',
        'Completed tasks for this day will be permanently deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', style: 'destructive', onPress: handleClearCompleted },
        ]
      );
      setShowPlannerSheet(false);
    }}
    completedCount={completedCount}
    currentSort={taskSort}
  />
  ```

- [ ] **Step 10: Commit**

  ```bash
  git add studytrack-frontend/src/screens/DailyPlannerScreen.jsx
  git commit -m "feat: wire PlannerActionSheet, task sorting, recurring handleToggleComplete, and ellipsis header"
  ```

---

## Task 10: Update CLAUDE.md Files

**Files:**
- Modify: `studytrack-backend/CLAUDE.md`
- Modify: `studytrack-frontend/CLAUDE.md`

- [ ] **Step 1: Update backend CLAUDE.md**

  In the Schema models table, update the `Task` row to mention the new fields, and add a `RecurringTaskCompletion` row:

  Find the Task row:
  ```
  | `Task` | `id`, `userId`, `title`, `subjectId?`, `dueDate?`, `estimatedMinutes?`, `completed`, `completedAt?`, `carriedOver` | `carriedOver` flags tasks rolled from a previous day |
  ```

  Replace with:
  ```
  | `Task` | `id`, `userId`, `title`, `subjectId?`, `dueDate?`, `estimatedMinutes?`, `completed`, `completedAt?`, `carriedOver`, `isRecurring` (default false), `recurringDays (Int[])`, `createdAt` | `carriedOver` flags tasks from a previous day; `isRecurring` + `recurringDays` define weekly repeat schedule; completion tracked via `RecurringTaskCompletion` |
  | `RecurringTaskCompletion` | `id`, `taskId`, `userId`, `date` (YYYY-MM-DD), `completedAt` | Tracks per-day completion for recurring tasks; `@@unique([taskId, date])` ensures one record per task per day |
  ```

  In the Tasks endpoint table, update the GET and PATCH descriptions:

  Find: `| `GET` | `/api/tasks?date=` | List caller's tasks; userId from JWT; optional `date` (YYYY-MM-DD) filters by dueDate |`
  Replace with: `| `GET` | `/api/tasks?date=` | Returns non-recurring tasks matching dueDate + recurring tasks where day-of-week is in recurringDays; recurring tasks include `completedOnDate` and `completedAtOnDate` fields |`

  Find: `| `PATCH` | `/api/tasks/:id` | Update `title`, `completed` (also sets `completedAt`), `carriedOver`, `dueDate`, `subjectId`, `estimatedMinutes` |`
  Replace with: `| `PATCH` | `/api/tasks/:id` | Update task fields; for recurring tasks with `completed` in body, upserts/deletes `RecurringTaskCompletion` instead of touching base `completed`; requires `date` (YYYY-MM-DD) for recurring completion |`

- [ ] **Step 2: Update frontend CLAUDE.md**

  In the components table, add `PlannerActionSheet`:
  ```
  | `PlannerActionSheet` | Bottom sheet for DailyPlannerScreen overflow: Add Task, Sort by Subject/Time, Clear Completed, Add Event |
  ```

  In the utilities section (`src/utils/`), add:
  ```
  | `formatRecurringLabel(days)` | Converts recurringDays int array to human-readable string (e.g., "Weekdays", "Mon, Wed, Fri") |
  ```

  Add a note about recurring task completion logic (e.g., after the existing session API flow note):
  ```
  - **Recurring tasks use per-day completion records** — PATCH /tasks/:id with `{ completed, date }` for a recurring task writes to `RecurringTaskCompletion`, never to `task.completed`. GET /tasks?date= returns `completedOnDate` for recurring tasks.
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add studytrack-backend/CLAUDE.md studytrack-frontend/CLAUDE.md
  git commit -m "docs: update CLAUDE.md for recurring tasks, RecurringTaskCompletion, PlannerActionSheet"
  ```

---

## Manual Test Checklist

Run `npx expo start --clear` and test on device in this order:

**Test A — Create recurring task:**
- Tap "+ Add task" → type "Morning review"
- Toggle Repeat ON → day pills animate in
- Tap M, W, F → pills turn blue
- Tap Save → task appears with repeat icon + "Mon, Wed, Fri" label

**Test B — Recurring across dates:**
- Navigate date strip to next Monday → "Morning review" visible
- Navigate to Tuesday → not visible
- Navigate to Wednesday → visible again

**Test C — Per-day completion:**
- On Monday → check "Morning review" → shows done
- Navigate to Wednesday → shows NOT done
- Check it on Wednesday → done
- Navigate back to Monday → still done

**Test D — Overflow menu opens:**
- Tap 3-dot icon → PlannerActionSheet slides up
- All rows visible; Clear Completed absent if no completed tasks

**Test E — Sort tasks:**
- Add 3 tasks with different subjects
- Open overflow → Sort by Subject → tasks reorder + checkmark on row
- Open overflow → Sort by Subject again → reverts to default

**Test F — Clear Completed:**
- Complete 2 non-recurring tasks
- Open overflow → "Clear Completed (2)" in red
- Tap → confirm → tasks removed; recurring tasks (if any) remain

**Test G — Add from overflow:**
- Open overflow → Add Task → TaskFormSheet opens
- Open overflow → Add Event → ScheduleEventFormSheet opens
