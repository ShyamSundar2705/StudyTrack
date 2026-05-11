import React, { useEffect, useRef } from 'react'
import { Modal, View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, radius } from '../constraints/theme'

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

  const Row = ({ icon, label, onPress, color, bgColor, rightIcon }) => (
    <TouchableOpacity
      style={[styles.row, bgColor && { backgroundColor: bgColor }]}
      onPress={() => { onPress(); onClose(); }}
      activeOpacity={0.7}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={color ?? colors.textPrimary} />
        <Text style={[styles.rowLabel, color && { color }]}>{label}</Text>
      </View>
      {rightIcon && <Ionicons name={rightIcon} size={16} color={colors.accentPrimary} />}
    </TouchableOpacity>
  )

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* TASKS section */}
        <Text style={styles.sectionLabel}>TASKS</Text>

        <Row icon="add-circle-outline" label="Add Task" onPress={onAddTask} color={colors.accentLight} />
        <Row
          icon="color-filter-outline"
          label="Sort by Subject"
          onPress={onSortBySubject}
          rightIcon={currentSort === 'subject' ? 'checkmark' : undefined}
        />
        <Row
          icon="time-outline"
          label="Sort by Time Added"
          onPress={onSortByTime}
          rightIcon={currentSort === 'time' ? 'checkmark' : undefined}
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* Clear completed — only when completedCount > 0 */}
        {completedCount > 0 && (
          <Row
            icon="trash-outline"
            label={`Clear Completed (${completedCount})`}
            onPress={onClearCompleted}
            color={colors.danger}
            bgColor={`${colors.danger}0D`}
          />
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* EVENTS section */}
        <Text style={styles.sectionLabel}>EVENTS</Text>
        <Row icon="calendar-outline" label="Add Event" onPress={onAddEvent} color={colors.accentLight} />

        {/* Cancel button */}
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
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
    backgroundColor: colors.surfaceDeep,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  handleContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xxl,
    marginVertical: spacing.xs,
  },
  cancelBtn: {
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
})
