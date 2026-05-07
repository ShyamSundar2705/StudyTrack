import React, { useEffect, useRef, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList,
  Animated, StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../constraints/theme';
import useSubjectStore from '../store/useSubjectStore';
import useSessionStore from '../store/useSessionStore';

const OFF_SCREEN = Dimensions.get('window').height;

function formatTodayDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m today';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m today`;
  if (h > 0) return `${h}h today`;
  return `${m}m today`;
}

export default function SubjectSwitchSheet({
  visible,
  currentSubjectId,
  onSelect,
  onClose,
}) {
  const translateY = useRef(new Animated.Value(OFF_SCREEN)).current;
  const insets     = useSafeAreaInsets();
  const subjects   = useSubjectStore((s) => s.subjects);
  const todaySessions = useSessionStore((s) => s.todaySessions);

  // Compute today's total seconds per subject
  const todaySecondsBySubject = useMemo(() => {
    const map = {};
    for (const session of todaySessions) {
      const secs = session.elapsedSeconds ?? session.durationSeconds ?? 0;
      map[session.subjectId] = (map[session.subjectId] ?? 0) + secs;
    }
    return map;
  }, [todaySessions]);

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

  const handleRowPress = (subject) => {
    if (subject.id === currentSubjectId) {
      onClose();
    } else {
      onSelect(subject);
      onClose();
    }
  };

  const renderSubject = ({ item }) => {
    const isActive   = item.id === currentSubjectId;
    const initial    = item.name.charAt(0).toUpperCase();
    const todaySecs  = todaySecondsBySubject[item.id] ?? 0;
    const subjectColor = item.colorHex ?? item.color ?? colors.accentPrimary;

    return (
      <TouchableOpacity
        style={[styles.row, isActive && styles.rowActive]}
        onPress={() => handleRowPress(item)}
        activeOpacity={0.7}
      >
        {/* Color circle with initial */}
        <View style={[styles.circle, { backgroundColor: subjectColor }]}>
          <Text style={styles.initial}>{initial}</Text>
        </View>

        {/* Subject info */}
        <View style={styles.info}>
          <Text style={styles.subjectName}>{item.name}</Text>
          <Text style={styles.todayLabel}>{formatTodayDuration(todaySecs)}</Text>
        </View>

        {/* Checkmark on active */}
        {isActive && (
          <Ionicons name="checkmark" size={20} color={colors.accentPrimary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + 16 }]}
      >
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Header */}
        <Text style={styles.header}>Switch Subject</Text>
        <Text style={styles.subtitle}>Current session time carries over</Text>

        {/* Subject list */}
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.id}
          renderItem={renderSubject}
          style={styles.list}
          scrollEnabled={subjects.length > 6}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  header: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: spacing.xxl,
    marginTop: spacing.lg,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: spacing.xxl,
    marginTop: 4,
  },
  list: {
    marginTop: spacing.md,
  },
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    backgroundColor: 'transparent',
  },
  rowActive: {
    backgroundColor: colors.surfaceBlue,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  todayLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
