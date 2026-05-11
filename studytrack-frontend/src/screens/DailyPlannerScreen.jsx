import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, ActivityIndicator,
  Alert, PanResponder, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, spacing } from '../constraints/theme';
import useSubjectStore from '../store/useSubjectStore';
import useUserStore from '../store/useUserStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TaskFormSheet from '../components/TaskFormSheet';
import ScheduleEventFormSheet from '../components/ScheduleEventFormSheet';
import PlannerActionSheet from '../components/PlannerActionSheet';
import api from '../api/client';
import { getTasks } from '../api/tasks';
import { formatRecurringLabel } from '../utils/dateTime';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildWeekDates(selectedDate) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { day: DAY_LABELS[d.getDay()], date: String(d.getDate()), iso, active: iso === selectedDate };
  });
}

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Convert an ISO date string (YYYY-MM-DD) to a Date object at local midnight
function isoToDate(isoStr) {
  const [year, month, day] = isoStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Transform backend task { id, title, completed, dueDate, subjectId } to frontend shape
function transformTask(task, subjects) {
  const now = new Date();
  let status = 'pending';
  let overdue = false;

  if (task.isRecurring) {
    // Recurring: completion is per-day
    if (task.completedOnDate) status = 'done';
  } else {
    if (task.completed) {
      status = 'done';
    } else if (task.dueDate && new Date(task.dueDate) < now) {
      status = 'overdue';
      overdue = true;
    }
  }

  const subject = subjects.find((s) => s.id === task.subjectId);
  const tags = subject ? [{ label: subject.name, color: subject.color ?? subject.colorHex }] : [];
  const accentColor = status === 'overdue' ? colors.danger : null;
  const subjectName = subject?.name ?? null;

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
    isRecurring: task.isRecurring ?? false,
    recurringDays: task.recurringDays ?? [],
    subjectName,
    createdAt: task.createdAt ?? null,
  };
}

// ── SwipeableTaskRow ────────────────────────────────────────────────────────
function SwipeableTaskRow({ task, onToggle, onEdit, onDelete }) {
  const swipeX = useRef(new Animated.Value(0)).current;
  const DELETE_THRESHOLD = 80;
  const DELETE_BTN_WIDTH = 72;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dy) < 20,
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dx < 0) {
        swipeX.setValue(Math.max(gestureState.dx, -DELETE_BTN_WIDTH));
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx < -DELETE_THRESHOLD) {
        Animated.spring(swipeX, { toValue: -DELETE_BTN_WIDTH, useNativeDriver: false }).start();
      } else {
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: false }).start();
      }
    },
  })).current;

  const confirmDelete = () => {
    Alert.alert(
      'Delete Task?',
      `"${task.title}" will be permanently deleted.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => Animated.spring(swipeX, { toValue: 0, useNativeDriver: false }).start(),
        },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(task.id) },
      ]
    );
  };

  return (
    <View>
      {/* Delete button behind the card */}
      <View style={[styles.deleteBtn, { width: DELETE_BTN_WIDTH }]}>
        <TouchableOpacity style={styles.deleteBtnInner} onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      {/* Card slides left to reveal delete button; explicit bg covers delete btn at rest */}
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX: swipeX }], backgroundColor: colors.background }}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.taskCard,
            task.accentColor && { borderLeftColor: task.accentColor, borderLeftWidth: 4 },
            task.status === 'active' && styles.taskCardActive,
          ]}
          onPress={() => onEdit(task)}
        >
          <TouchableOpacity onPress={() => onToggle(task)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {task.status === 'done' ? (
              <View style={styles.checkboxDone}>
                <Ionicons name="checkmark" size={14} color={colors.textPrimary} />
              </View>
            ) : task.status === 'active' ? (
              <View style={styles.checkboxActive}>
                <View style={styles.checkboxActiveDot} />
              </View>
            ) : (
              <View style={styles.checkboxEmpty} />
            )}
          </TouchableOpacity>
          <View style={styles.taskBody}>
            <View style={styles.taskTitleRow}>
              <Text style={[styles.taskTitle, task.status === 'done' && styles.taskTitleDone]}>
                {task.title}
              </Text>
              {task.isRecurring && (
                <Ionicons name="repeat-outline" size={12} color={colors.accentLight} style={{ marginLeft: 4, marginTop: 2 }} />
              )}
            </View>
            {task.isRecurring && (
              <Text style={styles.recurringLabel}>{formatRecurringLabel(task.recurringDays)}</Text>
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
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function DailyPlannerScreen({ navigation }) {
  const subjects = useSubjectStore((s) => s.subjects);
  const streak   = useUserStore((s) => s.streak);
  const insets   = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(isoToday());
  const [recap,        setRecap]        = useState({ streak: 0, tasksCompleted: 0, tasksTotal: 0, incompleteTask: null });

  // New API-backed state
  const [tasks,          setTasks]          = useState([]);
  const [events,         setEvents]         = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [showTaskForm,   setShowTaskForm]   = useState(false);
  const [editingTask,    setEditingTask]    = useState(null);
  const [showEventForm,  setShowEventForm]  = useState(false);
  const [editingEvent,   setEditingEvent]   = useState(null);
  const [showPlannerSheet, setShowPlannerSheet] = useState(false);
  const [taskSort, setTaskSort] = useState('default');

  const sortedTasks = useMemo(() => {
    if (taskSort === 'subject') {
      return [...tasks].sort((a, b) => {
        if (!a.subjectName && !b.subjectName) return 0;
        if (!a.subjectName) return 1;
        if (!b.subjectName) return -1;
        return a.subjectName.localeCompare(b.subjectName);
      });
    }
    if (taskSort === 'time') {
      return [...tasks].sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
    }
    // default: incomplete first, completed last
    return [...tasks].sort((a, b) => {
      const aDone = a.isRecurring ? a.completedOnDate : a.completed;
      const bDone = b.isRecurring ? b.completedOnDate : b.completed;
      if (aDone === bDone) return 0;
      return aDone ? 1 : -1;
    });
  }, [tasks, taskSort]);

  const completedCount = tasks.filter(t => t.isRecurring ? t.completedOnDate : t.completed).length;

  const dates = buildWeekDates(selectedDate);

  // ── Fetch tasks + events when date changes or screen gains focus ────────────
  useFocusEffect(
    useCallback(() => {
      fetchForDate(selectedDate);
    }, [selectedDate])
  );


  const fetchForDate = async (isoDate) => {
    setIsLoadingTasks(true);
    try {
      const [tasksRes, eventsRes] = await Promise.all([
        api.get(`/tasks?date=${isoDate}`),
        api.get(`/schedule-events?date=${isoDate}`),
      ]);
      const rawTasks = tasksRes.data.data.tasks;
      setTasks(Array.isArray(rawTasks) ? rawTasks.map((t) => transformTask(t, subjects)) : []);
      const rawEvents = eventsRes.data.data.events;
      setEvents(Array.isArray(rawEvents) ? rawEvents : []);
    } catch (err) {
      console.error('Planner fetch failed:', err);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // ── Load yesterday's recap once on mount ─────────────────────────────────
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterdayIso = d.toISOString().slice(0, 10);
    getTasks(yesterdayIso).then((raw) => {
      if (!Array.isArray(raw)) return;
      setRecap({
        streak,
        tasksCompleted: raw.filter((t) => t.completed).length,
        tasksTotal:     raw.length,
        incompleteTask: raw.find((t) => !t.completed)?.title ?? null,
      });
    }).catch(() => {});
  }, []);

  // ── Task handlers ─────────────────────────────────────────────────────────
  const handleToggleComplete = async (task) => {
    const newCompleted = task.status !== 'done';

    if (task.isRecurring) {
      // Optimistic update using completedOnDate
      setTasks((prev) => prev.map((t) =>
        t.id === task.id
          ? { ...t, status: newCompleted ? 'done' : 'pending', completedOnDate: newCompleted }
          : t
      ));
      try {
        await api.patch(`/tasks/${task.id}`, {
          completed: newCompleted,
          date: selectedDate,
        });
      } catch {
        fetchForDate(selectedDate);
      }
    } else {
      // Non-recurring: existing behaviour
      setTasks((prev) => prev.map((t) =>
        t.id === task.id
          ? { ...t, status: newCompleted ? 'done' : 'pending', completed: newCompleted, accentColor: newCompleted ? null : t.accentColor, overdue: newCompleted ? false : t.overdue }
          : t
      ));
      try {
        await api.patch(`/tasks/${task.id}`, {
          completed: newCompleted,
          completedAt: newCompleted ? new Date().toISOString() : null,
        });
      } catch {
        fetchForDate(selectedDate);
      }
    }
  };

  const handleDeleteTask = async (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await api.delete(`/tasks/${taskId}`);
    } catch {
      fetchForDate(selectedDate);
    }
  };

  const handleClearCompleted = async () => {
    const toDelete = tasks.filter(t => !t.isRecurring && t.completed);
    setTasks(prev => prev.filter(t => t.isRecurring || !t.completed));
    await Promise.allSettled(toDelete.map(t => api.delete(`/tasks/${t.id}`)));
  };

  const handleTaskSaved = (savedTask) => {
    if (editingTask) {
      setTasks((prev) => prev.map((t) => t.id === savedTask.id ? transformTask(savedTask, subjects) : t));
    } else {
      setTasks((prev) => [...prev, transformTask(savedTask, subjects)]);
    }
  };

  const handleEventSaved = (savedEvent) => {
    if (editingEvent) {
      setEvents((prev) => prev.map((e) => e.id === savedEvent.id ? savedEvent : e));
    } else {
      setEvents((prev) => [...prev, savedEvent].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    }
  };

  // selectedDate is an ISO string; form sheets need a Date object
  const selectedDateObj = isoToDate(selectedDate);

  return (
    <View style={styles.container}>

      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="calendar-outline" size={24} color={colors.accentPrimary} />
          <Text style={styles.headerTitle}>Planner</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setShowPlannerSheet(true)}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Date strip ──────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStrip}
        >
          {dates.map((d) => (
            <TouchableOpacity
              key={d.iso}
              style={styles.dateItem}
              onPress={() => setSelectedDate(d.iso)}
            >
              <View style={[styles.dateCell, d.active && styles.dateCellActive]}>
                <Text style={[styles.dateDayLabel, d.active && styles.dateLabelActive]}>{d.day}</Text>
                <Text style={[styles.dateNumber, d.active && styles.dateNumberActive]}>{d.date}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Yesterday recap ─────────────────────────────── */}
        <View style={styles.recapCard}>
          <Text style={styles.recapHeading}>YESTERDAY RECAP</Text>
          <View style={styles.recapStats}>
            {[
              { value: String(recap.streak), label: 'Day Streak' },
              { value: recap.tasksTotal > 0 ? `${recap.tasksCompleted}/${recap.tasksTotal}` : '—', label: 'Tasks Done' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <View style={styles.recapDivider} />}
                <View style={styles.recapStat}>
                  <Text style={styles.recapStatValue}>{s.value}</Text>
                  <Text style={styles.recapStatLabel}>{s.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          {recap.incompleteTask ? (
            <View style={styles.recapFooter}>
              <View style={[styles.recapDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.recapFooterText}>
                Incomplete: <Text style={styles.recapFooterBold}>{recap.incompleteTask}</Text>
              </Text>
            </View>
          ) : recap.tasksTotal > 0 ? (
            <View style={styles.recapFooter}>
              <View style={[styles.recapDot, { backgroundColor: colors.success }]} />
              <Text style={styles.recapFooterText}>All tasks completed!</Text>
            </View>
          ) : null}
        </View>

        {/* ── Today's tasks ───────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Tasks</Text>
            {isLoadingTasks
              ? <ActivityIndicator color={colors.accentPrimary} size="small" />
              : <Text style={styles.sectionCount}>{sortedTasks.length} total</Text>
            }
          </View>

          {isLoadingTasks ? (
            <ActivityIndicator color={colors.accentPrimary} style={{ marginVertical: spacing.xl }} />
          ) : sortedTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No tasks for this day</Text>
              <TouchableOpacity onPress={() => { setEditingTask(null); setShowTaskForm(true); }}>
                <Text style={styles.emptyStateAction}>+ Add your first task</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sortedTasks.map((task) => (
              <SwipeableTaskRow
                key={task.id}
                task={task}
                onToggle={handleToggleComplete}
                onEdit={(t) => { setEditingTask(t); setShowTaskForm(true); }}
                onDelete={handleDeleteTask}
              />
            ))
          )}

          {/* "+ Add task" button — always visible when not loading */}
          {!isLoadingTasks && (
            <TouchableOpacity
              style={styles.addTaskBtn}
              onPress={() => { setEditingTask(null); setShowTaskForm(true); }}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.addTaskText}>Add another task</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Schedule / Events ───────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Schedule</Text>
          </View>

          {isLoadingTasks ? null : events.length === 0 ? (
            <Text style={styles.emptyEventsText}>No events scheduled</Text>
          ) : (
            <View style={styles.timeline}>
              <View style={styles.timelineLine} />
              {events.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.timelineEvent}
                  activeOpacity={0.8}
                  onPress={() => { setEditingEvent(event); setShowEventForm(true); }}
                >
                  <View
                    style={[
                      styles.timelineDotRing,
                      {
                        borderColor: colors.background,
                        backgroundColor: event.color ?? colors.accentPrimary,
                      },
                    ]}
                  >
                    <View style={[styles.timelineDot, { backgroundColor: colors.textPrimary }]} />
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.eventTime, { color: event.color ?? colors.accentLight }]}>
                      {event.startTime}
                    </Text>
                    <View style={[styles.eventCard, { borderLeftColor: event.color ?? colors.accentPrimary }]}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      {event.durationMinutes ? (
                        <Text style={styles.eventSubtitle}>{event.durationMinutes} min</Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Focus banner ────────────────────────────────── */}
        <TouchableOpacity
          style={styles.focusBanner}
          onPress={() => navigation.navigate('HomeTab')}
        >
          <View style={styles.focusBannerLeft}>
            <View style={styles.boltCircle}>
              <Ionicons name="flash" size={22} color={colors.textPrimary} />
            </View>
            <View>
              <Text style={styles.focusTitle}>Ready to focus?</Text>
              <Text style={styles.focusSub}>Start your deep study timer now</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.accentLight} />
        </TouchableOpacity>
      </ScrollView>

      {/* ── Form Sheets ─────────────────────────────────────── */}
      <TaskFormSheet
        visible={showTaskForm}
        task={editingTask}
        defaultDate={selectedDateObj}
        onSave={handleTaskSaved}
        onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
      />

      <ScheduleEventFormSheet
        visible={showEventForm}
        event={editingEvent}
        defaultDate={selectedDateObj}
        onSave={handleEventSaved}
        onClose={() => { setShowEventForm(false); setEditingEvent(null); }}
      />

      <PlannerActionSheet
        visible={showPlannerSheet}
        onClose={() => setShowPlannerSheet(false)}
        onAddTask={() => { setEditingTask(null); setShowTaskForm(true); }}
        onAddEvent={() => { setEditingEvent(null); setShowEventForm(true); }}
        onSortBySubject={() => setTaskSort(prev => prev === 'subject' ? 'default' : 'subject')}
        onSortByTime={() => setTaskSort(prev => prev === 'time' ? 'default' : 'time')}
        onClearCompleted={handleClearCompleted}
        completedCount={completedCount}
        currentSort={taskSort}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // ── Header ───────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerBtn: { padding: spacing.xs },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.accentPrimary },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl },

  // ── Date strip ────────────────────────────────────────────────
  dateStrip: { gap: spacing.md, paddingVertical: spacing.xs },
  dateItem: { alignItems: 'center', gap: spacing.xs, minWidth: 56 },
  dateCell: {
    width: 56,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateCellActive: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentLight,
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  dateDayLabel: { fontSize: 12, color: colors.textSecondary },
  dateLabelActive: { color: colors.textPrimary, fontWeight: '700' },
  dateNumber: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
  },
  dateNumberActive: { color: colors.textPrimary },
  dateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentPrimary },
  dateDotFaint: { opacity: 0.4 },
  dateDotPlaceholder: { width: 6, height: 6 },

  // ── Recap card ────────────────────────────────────────────────
  recapCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentPrimary,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  recapHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.5,
  },
  recapStats: { flexDirection: 'row', alignItems: 'center' },
  recapStat: { flex: 1, alignItems: 'center', gap: 4 },
  recapStatValue: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
  },
  recapStatLabel: { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.5 },
  recapDivider: { width: 1, height: 32, backgroundColor: colors.border },
  recapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recapDot: { width: 8, height: 8, borderRadius: 4 },
  recapFooterText: { fontSize: 12, color: colors.textSecondary },
  recapFooterBold: { color: colors.textPrimary, fontWeight: '500' },

  // ── Tasks ─────────────────────────────────────────────────────
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },
  sectionCount: { fontSize: 12, color: colors.textSecondary },

  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  taskCardActive: { borderColor: colors.accentPrimary, borderWidth: 0.5 },

  checkboxDone: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentLight,
  },
  checkboxEmpty: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: colors.border,
  },

  taskBody: { flex: 1, gap: 4 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center' },
  recurringLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
  taskTitle: { fontSize: 16, color: colors.textPrimary, fontWeight: '500' },
  taskTitleDone: { color: colors.textSecondary },
  taskTags: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  tag: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 0.5,
    backgroundColor: colors.surfaceDeep,
  },
  tagText: { fontSize: 10, fontWeight: '500' },
  overdueLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger,
    letterSpacing: 0.5,
  },

  // ── Empty states ──────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  emptyStateAction: {
    color: colors.accentLight,
    fontSize: 13,
  },
  emptyEventsText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  // ── Add task button ───────────────────────────────────────────
  addTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  addTaskText: { fontSize: 16, color: colors.textSecondary },

  // ── Swipe-to-delete ───────────────────────────────────────────
  deleteBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnInner: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Timeline ──────────────────────────────────────────────────
  timeline: {
    marginLeft: spacing.md,
    gap: spacing.xl,
  },
  timelineLine: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 1,
    backgroundColor: colors.border,
  },
  timelineEvent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
  },
  timelineDotRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    marginTop: 2,
    borderWidth: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineContent: { flex: 1, gap: 4 },
  eventTime: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    gap: 4,
  },
  eventTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  eventSubtitle: { fontSize: 12, color: colors.textSecondary },

  // ── Focus banner ──────────────────────────────────────────────
  focusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceBlue,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    borderRadius: radius.md,
    padding: spacing.xxl,
  },
  focusBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  boltCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  focusSub: { fontSize: 12, color: colors.accentLight, marginTop: 2 },
});
