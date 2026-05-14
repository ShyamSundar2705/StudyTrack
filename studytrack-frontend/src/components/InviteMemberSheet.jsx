import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../constraints/theme';

export default function InviteMemberSheet({ visible, group, onClose }) {
  const [codeCopied, setCodeCopied] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setCodeCopied(false);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      slideAnim.setValue(600);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 200,
      useNativeDriver: true,
    }).start(onClose);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(group?.inviteCode ?? '');
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleShare = async () => {
    const message =
      `Join my study group "${group?.name}" on StudyTrack!\n\n` +
      `Use invite code: ${group?.inviteCode}\n\n` +
      `Download StudyTrack to get started.`;

    await Share.share({
      message,
      title: `Join ${group?.name} on StudyTrack`,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Invite to Group</Text>
        </View>

        {/* Group context pill */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Ionicons name="people-outline" size={14} color={colors.accentLight} />
            <Text style={styles.pillText}>{group?.name}</Text>
          </View>
        </View>

        {/* Invite code card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Invite Code</Text>
          <Text style={styles.codeValue}>{group?.inviteCode}</Text>

          {/* Copy row */}
          <TouchableOpacity style={styles.copyRow} onPress={handleCopy} activeOpacity={0.7}>
            <Ionicons
              name={codeCopied ? 'checkmark-circle' : 'copy-outline'}
              size={20}
              color={codeCopied ? colors.success : colors.accentLight}
            />
            <Text style={[styles.copyText, codeCopied && styles.copyTextSuccess]}>
              {codeCopied ? 'Copied!' : 'Copy code'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Share button */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={18} color={colors.textPrimary} />
          <Text style={styles.shareBtnText}>Share Invite Link</Text>
        </TouchableOpacity>

        {/* Hint */}
        <Text style={styles.hint}>Anyone with this code can join your group</Text>

        <View style={styles.bottomSafe} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pillRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceDeep,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: spacing.lg,
  },
  pillText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  codeCard: {
    marginHorizontal: spacing.xxl,
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    borderWidth: 0.5,
    borderColor: colors.accentPrimary,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  codeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 10,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  copyText: {
    fontSize: 14,
    color: colors.accentLight,
  },
  copyTextSuccess: {
    color: colors.success,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xxl,
    marginTop: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 12,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.lg,
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.lg,
    height: 52,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: spacing.xxl,
  },
  bottomSafe: {
    height: 24,
  },
});
