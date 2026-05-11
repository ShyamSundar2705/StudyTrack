import React, { useState, useEffect, useRef } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, Animated, Keyboard, KeyboardAvoidingView,
  Platform, StyleSheet
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../constraints/theme'
import useSubjectStore from '../store/useSubjectStore'
import TimePickerModal from './TimePickerModal'
import api from '../api/client'

function getDefaultStartTime() {
  const now = new Date()
  const nextHour = now.getHours() + 1
  return { hours: nextHour >= 24 ? 0 : nextHour, minutes: 0 }
}

function parseTime(timeStr) {
  if (!timeStr) return getDefaultStartTime()
  const [h, m] = timeStr.split(':').map(Number)
  return { hours: h, minutes: m }
}

function formatDisplayTime({ hours, minutes }) {
  const h = hours % 12 === 0 ? 12 : hours % 12
  const ampm = hours < 12 ? 'AM' : 'PM'
  const m = String(minutes).padStart(2, '0')
  return `${h}:${m} ${ampm}`
}

export default function ScheduleEventFormSheet({ visible, event, defaultDate, onSave, onClose }) {
  const subjects = useSubjectStore(s => s.subjects)

  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState(getDefaultStartTime())
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [subjectId, setSubjectId] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const slideAnim = useRef(new Animated.Value(400)).current

  useEffect(() => {
    if (visible) {
      setTitle(event?.title ?? '')
      setStartTime(event?.startTime ? parseTime(event.startTime) : getDefaultStartTime())
      setDurationMinutes(event?.durationMinutes ?? 60)
      setSubjectId(event?.subjectId ?? null)
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

  const handleClose = () => {
    Keyboard.dismiss()
    Animated.timing(slideAnim, {
      toValue: 400,
      duration: 200,
      useNativeDriver: true,
    }).start(onClose)
  }

  const handleSave = async () => {
    if (!title.trim() || isSubmitting) return
    setIsSubmitting(true)
    setError(null)

    // Convert { hours, minutes } to "HH:MM" string
    const startTimeStr = `${String(startTime.hours).padStart(2, '0')}:${String(startTime.minutes).padStart(2, '0')}`

    try {
      let savedEvent
      if (event) {
        const res = await api.patch(`/schedule-events/${event.id}`, {
          title: title.trim(),
          startTime: startTimeStr,
          durationMinutes,
          subjectId: subjectId || null,
        })
        savedEvent = res.data.data.event
      } else {
        const res = await api.post('/schedule-events', {
          title: title.trim(),
          date: `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`,
          startTime: startTimeStr,
          durationMinutes,
          subjectId: subjectId || null,
        })
        savedEvent = res.data.data.event
      }
      onSave(savedEvent)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save event. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const DURATION_CHIPS = [
    { label: '30m', value: 30 },
    { label: '45m', value: 45 },
    { label: '1h', value: 60 },
    { label: '1h 30m', value: 90 },
    { label: '2h', value: 120 },
    { label: '3h', value: 180 },
  ]

  const canSave = title.trim().length > 0 && !isSubmitting

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {event ? 'Edit Event' : 'Add Event'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={!canSave}>
              <Text style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title input */}
          <TextInput
            style={styles.input}
            placeholder="What's the event?"
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            autoFocus={!event}
            maxLength={200}
            returnKeyType="done"
          />

          {/* Start time row */}
          <Text style={styles.sectionLabel}>Start time</Text>
          <TouchableOpacity
            style={styles.timeRow}
            onPress={() => setShowTimePicker(true)}
          >
            <Ionicons name="time-outline" size={18} color={colors.accentLight} />
            <Text style={styles.timeText}>{formatDisplayTime(startTime)}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Duration chips */}
          <Text style={styles.sectionLabel}>Duration</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {DURATION_CHIPS.map(chip => {
              const active = durationMinutes === chip.value
              return (
                <TouchableOpacity
                  key={chip.label}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setDurationMinutes(chip.value)}
                >
                  <Text style={[styles.chipText, active && styles.chipActiveText]}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {/* Subject selector */}
          <Text style={styles.sectionLabel}>Subject</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            <TouchableOpacity
              style={[styles.pill, subjectId === null && styles.pillNoneActive]}
              onPress={() => setSubjectId(null)}
            >
              <Text style={[styles.pillText, subjectId === null && styles.pillNoneActiveText]}>
                None
              </Text>
            </TouchableOpacity>
            {subjects.map(s => {
              const active = subjectId === s.id
              const color = s.colorHex ?? s.color ?? colors.accentPrimary
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.pill, active && { backgroundColor: color }]}
                  onPress={() => setSubjectId(s.id)}
                >
                  <Text style={[styles.pillText, active && styles.pillActiveText]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {/* Error banner */}
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.bottomPad} />
        </KeyboardAvoidingView>
      </Animated.View>

      {/* TimePickerModal — mounted inside Modal but outside Animated.View
          so it renders on top of the sheet without translateY inheritance */}
      <TimePickerModal
        visible={showTimePicker}
        value={startTime}
        onChange={(time) => {
          setStartTime(time)
          setShowTimePicker(false)
        }}
        onClose={() => setShowTimePicker(false)}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.surfaceDeep,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 0,
  },
  handleContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveBtn: {
    color: colors.accentPrimary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  saveBtnDisabled: {
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xxl,
    color: colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    marginLeft: spacing.xxl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 52,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  timeText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  pillRow: {
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  pill: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillNoneActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  pillNoneActiveText: {
    color: colors.accentPrimary,
  },
  pillActiveText: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  chipRow: {
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.accentPrimary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  chipActiveText: {
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  errorBanner: {
    marginHorizontal: spacing.xxl,
    marginTop: spacing.md,
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    borderWidth: 0.5,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  bottomPad: {
    height: spacing.xl,
  },
})
