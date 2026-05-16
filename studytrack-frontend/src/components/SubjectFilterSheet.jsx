import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, Animated,
  StyleSheet, Dimensions, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '../constraints/theme';
import { useTheme } from '../context/ThemeContext';
import useSubjectStore from '../store/useSubjectStore';

const OFF_SCREEN = Dimensions.get('window').height;

export default function SubjectFilterSheet({
  visible,
  selectedSubjectId,
  onSelect,
  onClose,
  subjectHours = {},
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const translateY = useRef(new Animated.Value(OFF_SCREEN)).current;
  const insets = useSafeAreaInsets();
  const subjects = useSubjectStore((s) => s.subjects);

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

  const handleSelectAll = () => {
    onSelect(null);
    onClose();
  };

  const handleSelectSubject = (id) => {
    onSelect(id);
    onClose();
  };

  const renderSubjectRow = ({ item: subject }) => {
    const isSelected = selectedSubjectId === subject.id;
    const initial = subject.name.charAt(0).toUpperCase();
    const hours = subjectHours[subject.id];
    return (
      <>
        <TouchableOpacity
          style={[styles.row, isSelected && styles.rowActive]}
          onPress={() => handleSelectSubject(subject.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.subjectCircle, { backgroundColor: subject.color }]}>
            <Text style={styles.subjectInitial}>{initial}</Text>
          </View>
          <View style={styles.rowTextBlock}>
            <Text style={styles.rowLabel}>{subject.name}</Text>
            {hours != null && (
              <Text style={styles.rowSub}>{hours}</Text>
            )}
          </View>
          {isSelected && (
            <Ionicons name="checkmark" size={20} color={colors.accentPrimary} />
          )}
        </TouchableOpacity>
        <View style={styles.divider} />
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + 32 }]}
      >
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Filter by Subject</Text>
          {selectedSubjectId != null && (
            <TouchableOpacity onPress={() => { onSelect(null); onClose(); }}>
              <Text style={styles.clearBtn}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* All Subjects row */}
        <TouchableOpacity
          style={[styles.row, selectedSubjectId === null && styles.rowActive]}
          onPress={handleSelectAll}
          activeOpacity={0.7}
        >
          <Ionicons name="grid-outline" size={20} color={colors.accentLight} />
          <Text style={[styles.rowLabel, { marginLeft: spacing.sm }]}>All Subjects</Text>
          {selectedSubjectId === null && (
            <Ionicons name="checkmark" size={20} color={colors.accentPrimary} />
          )}
        </TouchableOpacity>
        <View style={styles.divider} />

        {/* Subject list */}
        <FlatList
          data={subjects}
          keyExtractor={(item) => item.id}
          renderItem={renderSubjectRow}
          scrollEnabled={subjects.length > 6}
          showsVerticalScrollIndicator={false}
        />

        {/* Cancel */}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  clearBtn: { fontSize: 14, color: colors.accentPrimary },
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  rowActive: { backgroundColor: colors.surfaceBlue },
  rowTextBlock: { flex: 1, gap: 2 },
  rowLabel: { flex: 1, fontSize: 15, color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textSecondary },
  subjectCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectInitial: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  divider: { height: 0.5, backgroundColor: colors.border, marginHorizontal: spacing.xxl },
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
