import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, Animated,
  StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '../constraints/theme';
import { useTheme } from '../context/ThemeContext';

const OFF_SCREEN = Dimensions.get('window').height;

export default function SessionActionSheet({
  visible,
  onClose,
  onSwitchSubject,
  onAddNote,
  onPomodoroSettings,
  onAbandon,
  isPomo,
  hasNote,
  currentSubjectName,
  currentSubjectColor,
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const translateY = useRef(new Animated.Value(OFF_SCREEN)).current;
  const insets     = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: OFF_SCREEN, duration: 220, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + 32 }]}
      >
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Session context pill */}
        <View style={styles.pill}>
          <View style={[styles.pillDot, { backgroundColor: currentSubjectColor }]} />
          <Text style={styles.pillText}>Studying — {currentSubjectName}</Text>
        </View>

        {/* Action rows */}
        <View style={styles.rows}>
          {/* Switch Subject */}
          <TouchableOpacity style={styles.row} onPress={onSwitchSubject} activeOpacity={0.7}>
            <Ionicons name="swap-horizontal" size={20} color={colors.accentLight} />
            <Text style={styles.rowLabel}>Switch Subject</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Add / Edit Note */}
          <TouchableOpacity style={styles.row} onPress={onAddNote} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={20} color={colors.accentLight} />
            <Text style={styles.rowLabel}>{hasNote ? 'Edit Note' : 'Add Note'}</Text>
            {hasNote
              ? <View style={styles.noteDot} />
              : <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
          </TouchableOpacity>

          {/* Pomodoro Settings — only in pomo mode */}
          {isPomo && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} onPress={onPomodoroSettings} activeOpacity={0.7}>
                <Ionicons name="timer-outline" size={20} color={colors.accentLight} />
                <Text style={styles.rowLabel}>Pomodoro Settings</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </>
          )}

          {/* Abandon — separated with gap + full-width divider */}
          <View style={[styles.dividerFull, { marginTop: spacing.sm }]} />
          <TouchableOpacity style={[styles.row, styles.abandonRow]} onPress={onAbandon} activeOpacity={0.7}>
            <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
            <Text style={[styles.rowLabel, { color: colors.danger }]}>Abandon Session</Text>
          </TouchableOpacity>
        </View>

        {/* Cancel button */}
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

function getStyles(colors) { return StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surfaceDeep,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 13, color: colors.textSecondary },
  rows: { marginTop: spacing.lg },
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  rowLabel: { flex: 1, fontSize: 15, color: colors.textPrimary },
  divider: { height: 0.5, backgroundColor: colors.border, marginHorizontal: spacing.xxl },
  dividerFull: { height: 0.5, backgroundColor: colors.border },
  noteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPrimary,
  },
  abandonRow: { backgroundColor: 'rgba(231, 76, 60, 0.05)' },
  cancelBtn: {
    marginHorizontal: spacing.xxl,
    marginTop: spacing.md,
    height: 52,
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, color: colors.textPrimary },
}); }
