import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius } from '../constraints/theme';
import { useTheme } from '../context/ThemeContext';

export default function NoGroupView({ onCreateGroup, onJoinGroup }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  return (
    <View style={styles.container}>
      <Ionicons name="people-outline" size={64} color={colors.border} />
      <Text style={styles.title}>No study group yet</Text>
      <Text style={styles.subtitle}>Join friends and study together.</Text>

      <TouchableOpacity style={styles.createBtn} onPress={onCreateGroup} activeOpacity={0.8}>
        <Ionicons name="add-circle-outline" size={18} color={colors.textPrimary} />
        <Text style={styles.createBtnText}>Create a Group</Text>
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity style={styles.joinBtn} onPress={onJoinGroup} activeOpacity={0.8}>
        <Ionicons name="key-outline" size={18} color={colors.accentLight} />
        <Text style={styles.joinBtnText}>Join with Code</Text>
      </TouchableOpacity>
    </View>
  );
}

function getStyles(colors) { return StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xxl,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.lg,
    height: 52,
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  createBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: spacing.md,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    height: 52,
    width: '100%',
    gap: spacing.sm,
  },
  joinBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
}); }
