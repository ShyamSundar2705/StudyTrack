import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../constraints/theme';
import { formatDateLabel } from '../utils/dateTime';

export default function DatePickerModal({ visible, selected, onSelect, onClose }) {
  const days = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 0; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      d.setHours(0, 0, 0, 0);
      result.push(d);
    }
    return result;
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Date</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.done}>Done</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={days}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => {
            const isSelected = selected && item.toDateString() === selected.toDateString();
            return (
              <TouchableOpacity
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>
                  {formatDateLabel(item)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  done: {
    color: colors.accentPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.surfaceElevated,
  },
  rowText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  rowTextSelected: {
    color: colors.accentLight,
    fontWeight: '600',
  },
});
