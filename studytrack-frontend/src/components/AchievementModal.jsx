import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../constraints/theme';
import { useTheme } from '../context/ThemeContext';
import { ACHIEVEMENT_META, CATEGORY_LABELS } from '../constants/achievements';

function formatUnlockedDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AchievementModal({ visible, achievement, onClose }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { width: screenWidth } = useWindowDimensions();
  const meta = ACHIEVEMENT_META[achievement?.type] ?? {
    name: achievement?.type ?? 'Achievement',
    icon: 'ribbon',
    iconColor: colors.accentPrimary,
    description: '',
    criteria: '',
    category: 'milestone',
  };

  const unlocked = achievement?.unlocked ?? (achievement?.unlockedAt != null);
  const categoryLabel = CATEGORY_LABELS[meta.category] ?? meta.category;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.centeredContainer} pointerEvents="box-none">
        <View style={[styles.card, { width: screenWidth * 0.85 }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Badge icon */}
          <View style={styles.iconWrapper}>
            <View style={[styles.iconCircle, {
              borderColor: meta.iconColor,
              backgroundColor: `${meta.iconColor}26`,
              shadowColor: meta.iconColor,
            }]}>
              <Ionicons name={meta.icon} size={36} color={meta.iconColor} />
              {!unlocked && (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={20} color={colors.textPrimary} />
                </View>
              )}
            </View>
          </View>

          {/* Name */}
          <Text style={styles.achievementName}>{meta.name}</Text>

          {/* Category pill */}
          <View style={[styles.categoryPill, { backgroundColor: `${meta.iconColor}26` }]}>
            <Text style={[styles.categoryText, { color: meta.iconColor }]}>
              {categoryLabel}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.description}>{meta.description}</Text>

          {/* Criteria row */}
          <View style={styles.criteriaRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.accentLight} />
            <Text style={styles.criteriaText}>{meta.criteria}</Text>
          </View>

          {/* Unlock info */}
          <View style={styles.unlockRow}>
            {unlocked ? (
              <>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.unlockText, { color: colors.success }]}>
                  Unlocked on {formatUnlockedDate(achievement?.unlockedAt)}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.unlockText, { color: colors.textSecondary }]}>
                  Not yet unlocked
                </Text>
              </>
            )}
          </View>

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(colors) { return StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  categoryPill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: spacing.xl,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    alignSelf: 'stretch',
    marginBottom: spacing.xl,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  criteriaRow: {
    backgroundColor: colors.surfaceDeep,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: spacing.lg,
  },
  criteriaText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  unlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.lg,
  },
  unlockText: {
    fontSize: 13,
  },
  closeButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  closeButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
}); }
