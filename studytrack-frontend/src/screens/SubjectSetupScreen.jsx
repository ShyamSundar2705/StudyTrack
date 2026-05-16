import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../constraints/theme';
import { useTheme } from '../context/ThemeContext';
import { createSubject } from '../api/subjects';
import useSubjectStore from '../store/useSubjectStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const QUICK_ADD = ['History', 'Biology', 'Programming', 'Art'];

export default function SubjectSetupScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const SWATCH_COLORS = [
    colors.accentLight,
    colors.success,
    colors.accent2,
    colors.danger,
    colors.gold,
  ];

  const { setSubjects: storeSetSubjects } = useSubjectStore();
  const insets = useSafeAreaInsets();

  const [subjects, setSubjects] = useState([
    { id: '1', name: 'Mathematics',        color: colors.accentLight },
    { id: '2', name: 'Physics',            color: colors.accent2     },
    { id: '3', name: 'English Literature', color: colors.success     },
    { id: '4', name: 'Piano Practice',     color: colors.danger      },
  ]);
  const [inputName, setInputName]       = useState('');
  const [selectedColor, setSelectedColor] = useState(colors.accentLight);
  const [saving, setSaving]             = useState(false);

  const addNewSubject = (name = inputName.trim()) => {
    if (!name) return;
    const id = Date.now().toString();
    setSubjects((prev) => [...prev, { id, name, color: selectedColor }]);
    setInputName('');
  };

  const removeSubject = (id) =>
    setSubjects((prev) => prev.filter((s) => s.id !== id));

  const handleStart = async () => {
    if (subjects.length === 0) {
      Alert.alert('Add at least one subject to continue.');
      return;
    }
    setSaving(true);
    try {
      // Sequential to avoid Prisma prepared-statement collision on concurrent INSERTs
      const results = [];
      for (const { name, color } of subjects) {
        const r = await createSubject({ name, colorHex: color });
        results.push(r);
      }
      const storeSubjects = results
        .map((r) => r?.data?.subject)
        .filter(Boolean)
        .map((s) => ({ id: s.id, name: s.name, color: s.colorHex, totalSeconds: 0 }));
      storeSetSubjects(storeSubjects.length > 0 ? storeSubjects : subjects);
    } catch (_) {
      storeSetSubjects(subjects);
    } finally {
      setSaving(false);
      navigation.replace('Main');
    }
  };

  return (
    <View style={styles.container}>

      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.accentPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Study Setup</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="help-circle-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Scrollable body ─────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Onboarding step dots */}
        <View style={styles.stepDots}>
          <View style={[styles.dot, styles.dotSmall]} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={[styles.dot, styles.dotSmall]} />
        </View>

        {/* Page heading */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>What do you study?</Text>
          <Text style={styles.pageSubtitle}>
            Add subjects to track your time. You can always edit these later.
          </Text>
        </View>

        {/* Add subject card */}
        <View style={styles.inputCard}>
          <View style={styles.inputRow}>
              <TextInput
              style={styles.textInput}
              placeholder="e.g. Mathematics"
              placeholderTextColor={colors.textSecondary}
              value={inputName}
              onChangeText={setInputName}
              onSubmitEditing={() => addNewSubject()}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={() => addNewSubject()}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Color swatches */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.swatchList}
          >
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
                />
              )
            )}
          </ScrollView>
        </View>

        {/* Quick add */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK ADD</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickAddList}
          >
              {QUICK_ADD.filter((name) => !subjects.some((s) => s.name === name)).map((name) => (
              <TouchableOpacity key={name} style={styles.quickChip} onPress={() => addNewSubject(name)}>
                <Ionicons name="add" size={18} color={colors.accentLight} />
                <Text style={styles.quickChipText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Your subjects */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR SUBJECTS</Text>
          <View style={styles.subjectList}>
            {subjects.map((s) => (
              <View key={s.id} style={styles.subjectCard}>
                <View style={[styles.subjectAccentBar, { backgroundColor: s.color }]} />
                <View style={styles.subjectBody}>
                  <View style={styles.subjectLeft}>
                    <Ionicons name="reorder-two-outline" size={20} color={colors.textSecondary} />
                    <View>
                      <Text style={styles.subjectName}>{s.name}</Text>
                      <Text style={styles.subjectTracked}>0h tracked</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => removeSubject(s.id)}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ── Footer ──────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startBtn, saving && { opacity: 0.7 }]}
          onPress={handleStart}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={colors.textPrimary} />
            : <>
                <Text style={styles.startBtnText}>Let's Start</Text>
                <Ionicons name="arrow-forward" size={22} color={colors.textPrimary} />
              </>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.replace('Main')}>
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(colors) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ───────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerBtn: {
    padding: spacing.xs,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accentPrimary,
  },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // ── Step dots ────────────────────────────────────────────────
  stepDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotSmall: {
    width: 6,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.accentPrimary,
  },

  // ── Page header ───────────────────────────────────────────────
  pageHeader: {
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // ── Input card ────────────────────────────────────────────────
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    gap: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    padding: 0,
  },
  addBtn: {
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm + 2,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  swatchList: {
    gap: spacing.md,
    alignItems: 'center',
  },
  // Selected swatch: outer ring + 2px gap (via padding + borderWidth)
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

  // ── Sections ──────────────────────────────────────────────────
  section: {
    marginBottom: spacing.xl,
    gap: spacing.lg,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  quickAddList: {
    gap: spacing.xs,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  quickChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accentLight,
  },

  // ── Subject list ──────────────────────────────────────────────
  subjectList: {
    gap: spacing.md,
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 64,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  subjectAccentBar: {
    width: 6,
  },
  subjectBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  subjectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subjectTracked: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteBtn: {
    padding: spacing.xs,
    borderRadius: radius.sm,
  },

  // ── Footer ───────────────────────────────────────────────────
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.lg,
    alignItems: 'center',
  },
  startBtn: {
    width: '100%',
    height: 56,
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  startBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  skipBtn: {
    paddingVertical: spacing.xs,
  },
  skipBtnText: {
    fontSize: 14,
    color: colors.accentLight,
    textDecorationLine: 'underline',
  },
}); }
