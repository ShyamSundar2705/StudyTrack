import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../constraints/theme';
import { manualSession as apiManualSession } from '../api/sessions';
import useSubjectStore from '../store/useSubjectStore';
import {
  combineDateAndTime,
  formatTime12h,
  formatDateLabel,
  formatDuration,
  getDefaultStartTime,
  getDefaultEndTime,
} from '../utils/dateTime';
import DatePickerModal from './DatePickerModal';
import TimePickerModal from './TimePickerModal';

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ManualLogModal({ visible, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const subjects = useSubjectStore((s) => s.subjects);

  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [date, setDate] = useState(todayMidnight);
  const [startTime, setStartTime] = useState(getDefaultStartTime);
  const [endTime, setEndTime] = useState(getDefaultEndTime);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const startDate = combineDateAndTime(date, startTime.hours, startTime.minutes);
  const endDate = combineDateAndTime(date, endTime.hours, endTime.minutes);
  const durationSeconds = Math.floor((endDate - startDate) / 1000);

  const durationValid = durationSeconds > 0 && durationSeconds <= 43200;
  const canSave = !!selectedSubjectId && durationValid;

  const reset = () => {
    setSelectedSubjectId(null);
    setDate(todayMidnight());
    setStartTime(getDefaultStartTime());
    setEndTime(getDefaultEndTime());
    setNote('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const result = await apiManualSession({
        subjectId: selectedSubjectId,
        startedAt: startDate.toISOString(),
        endedAt: endDate.toISOString(),
        note: note.trim() || undefined,
      });
      if (result) {
        const subject = subjects.find((s) => s.id === selectedSubjectId);
        onSaved({
          id: result.session.id,
          subjectId: selectedSubjectId,
          subjectName: subject?.name ?? '',
          startedAt: result.session.startedAt,
          elapsedSeconds: result.durationSeconds,
        });
        reset();
        onClose();
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error ?? 'Failed to save session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Log a Past Session</Text>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={colors.textPrimary} />
              : <Text style={styles.saveBtnText}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Subject */}
          <Text style={styles.sectionLabel}>Subject</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            {subjects.map((s) => {
              const active = selectedSubjectId === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.pill,
                    { borderColor: s.color },
                    active && { backgroundColor: s.color },
                  ]}
                  onPress={() => setSelectedSubjectId(s.id)}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Date */}
          <Text style={styles.sectionLabel}>Date</Text>
          <TouchableOpacity style={styles.fieldRow} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.fieldText}>{formatDateLabel(date)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Start time */}
          <Text style={styles.sectionLabel}>Start Time</Text>
          <TouchableOpacity style={styles.fieldRow} onPress={() => setShowStartPicker(true)}>
            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.fieldText}>{formatTime12h(startTime.hours, startTime.minutes)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* End time */}
          <Text style={styles.sectionLabel}>End Time</Text>
          <TouchableOpacity style={styles.fieldRow} onPress={() => setShowEndPicker(true)}>
            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.fieldText}>{formatTime12h(endTime.hours, endTime.minutes)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Duration hint */}
          {durationSeconds > 43200 && (
            <Text style={styles.errorHint}>Duration cannot exceed 12 hours</Text>
          )}
          {durationSeconds <= 0 && (
            <Text style={styles.errorHint}>End time must be after start time</Text>
          )}
          {durationValid && (
            <Text style={styles.durationHint}>Duration: {formatDuration(durationSeconds)}</Text>
          )}

          {/* Note */}
          <Text style={styles.sectionLabel}>Note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="What did you study?"
            placeholderTextColor={colors.textSecondary}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        selected={date}
        onSelect={setDate}
        onClose={() => setShowDatePicker(false)}
      />
      <TimePickerModal
        visible={showStartPicker}
        value={startTime}
        onChange={setStartTime}
        onClose={() => setShowStartPicker(false)}
      />
      <TimePickerModal
        visible={showEndPicker}
        value={endTime}
        onChange={setEndTime}
        onClose={() => setShowEndPicker(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: {
    padding: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 56,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  body: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  pillTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  fieldText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  durationHint: {
    color: colors.accentLight,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  errorHint: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
    minHeight: 80,
  },
});
