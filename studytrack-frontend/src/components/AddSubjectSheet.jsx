import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  Animated, StyleSheet, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '../constraints/theme';
import { useTheme } from '../context/ThemeContext';
import { createSubject } from '../api/subjects';
import useSubjectStore from '../store/useSubjectStore';

const OFF_SCREEN = Dimensions.get('window').height;

const SWATCH_COLORS = [
  '#4A90E2',
  '#27AE60',
  '#A855F7',
  '#E74C3C',
  '#FFD700',
];

export default function AddSubjectSheet({ visible, onClose, onAdded }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const translateY = useRef(new Animated.Value(OFF_SCREEN)).current;
  const insets = useSafeAreaInsets();
  const addSubject = useSubjectStore((s) => s.addSubject);
  const inputRef = useRef(null);

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(SWATCH_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start(() => inputRef.current?.focus());
    } else {
      Animated.timing(translateY, {
        toValue: OFF_SCREEN, duration: 220, useNativeDriver: true,
      }).start();
      setName('');
      setSelectedColor(SWATCH_COLORS[0]);
      setSaving(false);
    }
  }, [visible]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const r = await createSubject({ name: trimmed, colorHex: selectedColor });
      const s = r?.data?.subject;
      const newSubject = {
        id: s.id,
        name: s.name,
        color: s.colorHex,
        totalSeconds: 0,
      };
      addSubject(newSubject);
      onAdded(newSubject);
      onClose();
    } catch (_) {
      setSaving(false);
      Alert.alert('Could not add subject', 'Make sure the backend is running and try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Subject</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Subject name"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            onSubmitEditing={handleSave}
            returnKeyType="done"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.swatches}>
          {SWATCH_COLORS.map((color) =>
            color === selectedColor ? (
              <View key={color} style={[styles.swatchRing, { borderColor: color }]}>
                <View style={[styles.swatch, { backgroundColor: color }]} />
              </View>
            ) : (
              <TouchableOpacity
                key={color}
                style={[styles.swatch, { backgroundColor: color }]}
                onPress={() => setSelectedColor(color)}
                activeOpacity={0.8}
              />
            )
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={colors.textPrimary} />
            : <Text style={styles.saveBtnText}>Add Subject</Text>
          }
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  inputWrap: {
    marginHorizontal: spacing.xxl,
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    fontSize: 16,
    color: colors.textPrimary,
    padding: 0,
  },
  swatches: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
  swatchRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  saveBtn: {
    marginHorizontal: spacing.xxl,
    marginTop: spacing.xl,
    height: 52,
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
}); }
