import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { colors, spacing, radius } from '../constraints/theme';

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = Array.from({ length: 60 }, (_, i) => i);   // 0–59

function to12h(hours24) {
  return {
    hour12: hours24 % 12 || 12,
    period: hours24 >= 12 ? 'PM' : 'AM',
  };
}

function to24h(hour12, period) {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

export default function TimePickerModal({ visible, value, onChange, onClose }) {
  const [hour12Idx, setHour12Idx] = useState(0);
  const [minuteIdx, setMinuteIdx] = useState(0);
  const [period, setPeriod] = useState('AM');

  const hourRef = useRef(null);
  const minuteRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const { hour12, period: p } = to12h(value.hours);
    const hIdx = HOURS.indexOf(hour12);
    const mIdx = value.minutes;
    setHour12Idx(hIdx < 0 ? 0 : hIdx);
    setMinuteIdx(mIdx);
    setPeriod(p);
    setTimeout(() => {
      hourRef.current?.scrollTo({ y: (hIdx < 0 ? 0 : hIdx) * ITEM_HEIGHT, animated: false });
      minuteRef.current?.scrollTo({ y: mIdx * ITEM_HEIGHT, animated: false });
    }, 60);
  }, [visible]);

  const handleHourScrollEnd = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setHour12Idx(Math.max(0, Math.min(idx, HOURS.length - 1)));
  };

  const handleMinuteScrollEnd = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setMinuteIdx(Math.max(0, Math.min(idx, MINUTES.length - 1)));
  };

  const handleDone = () => {
    const h24 = to24h(HOURS[hour12Idx], period);
    onChange({ hours: h24, minutes: MINUTES[minuteIdx] });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Select Time</Text>
          <TouchableOpacity onPress={handleDone}>
            <Text style={styles.done}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pickerContainer}>
          {/* Selection highlight band */}
          <View pointerEvents="none" style={styles.selectionBand} />

          {/* Hour column */}
          <ScrollView
            ref={hourRef}
            style={styles.column}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onMomentumScrollEnd={handleHourScrollEnd}
            contentContainerStyle={styles.columnContent}
          >
            {HOURS.map((h, i) => (
              <View key={h} style={styles.item}>
                <Text style={[styles.itemText, i === hour12Idx && styles.itemTextSelected]}>
                  {h}
                </Text>
              </View>
            ))}
          </ScrollView>

          <Text style={styles.colon}>:</Text>

          {/* Minute column */}
          <ScrollView
            ref={minuteRef}
            style={styles.column}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            onMomentumScrollEnd={handleMinuteScrollEnd}
            contentContainerStyle={styles.columnContent}
          >
            {MINUTES.map((m, i) => (
              <View key={m} style={styles.item}>
                <Text style={[styles.itemText, i === minuteIdx && styles.itemTextSelected]}>
                  {m.toString().padStart(2, '0')}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* AM / PM toggle */}
          <TouchableOpacity
            style={styles.periodBtn}
            onPress={() => setPeriod((p) => (p === 'AM' ? 'PM' : 'AM'))}
          >
            <Text style={[styles.periodOption, period === 'AM' && styles.periodActive]}>AM</Text>
            <Text style={[styles.periodOption, period === 'PM' && styles.periodActive]}>PM</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: 32,
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
  cancel: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  done: {
    color: colors.accentPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: PICKER_HEIGHT,
    marginVertical: spacing.md,
  },
  selectionBand: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 24,
    right: 24,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
  },
  column: {
    width: 64,
    height: PICKER_HEIGHT,
  },
  columnContent: {
    paddingVertical: ITEM_HEIGHT * 2,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  itemTextSelected: {
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  colon: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  periodBtn: {
    marginLeft: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  periodOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  periodActive: {
    color: colors.textPrimary,
    backgroundColor: colors.accentPrimary,
  },
});
