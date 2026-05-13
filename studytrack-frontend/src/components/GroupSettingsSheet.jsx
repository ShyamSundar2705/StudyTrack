import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  Animated,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../constraints/theme';
import api from '../api/client';
import { disconnectGroupSocket } from '../api/socket';
import useUserStore from '../store/useUserStore';
import BottomSheetPicker from './BottomSheetPicker';

export default function GroupSettingsSheet({
  visible,
  group,
  isAdmin,
  onClose,
  onUpdated,
  onDeleted,
  onLeave,
}) {
  const [groupName, setGroupName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [maxMembers, setMaxMembers] = useState(20);
  const [currentInviteCode, setCurrentInviteCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showMaxMembersPicker, setShowMaxMembersPicker] = useState(false);
  const [error, setError] = useState(null);

  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible && group) {
      setGroupName(group.name);
      setIsPublic(group.isPublic);
      setMaxMembers(group.maxMembers);
      setCurrentInviteCode(group.inviteCode);
      setError(null);
      setIsSaving(false);
      setIsRegenerating(false);
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

  const hasChanges =
    groupName.trim() !== group?.name ||
    isPublic !== group?.isPublic ||
    maxMembers !== group?.maxMembers;

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await api.patch(`/groups/${group.id}`, {
        name: groupName.trim(),
        isPublic,
        maxMembers,
      });
      onUpdated(res.data.data.group);
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(currentInviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRegenerateCode = async () => {
    setIsRegenerating(true);
    setError(null);
    try {
      const res = await api.post(`/groups/${group.id}/regenerate-code`);
      const newCode = res.data.data.inviteCode;
      setCurrentInviteCode(newCode);
      onUpdated({ ...group, inviteCode: newCode });
    } catch (err) {
      setError('Failed to regenerate code');
    } finally {
      setIsRegenerating(false);
    }
  };

  const confirmRegenerateCode = () => {
    Alert.alert(
      'Regenerate Invite Code?',
      'The current code will stop working immediately. Share the new code with anyone who needs to join.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: handleRegenerateCode },
      ]
    );
  };

  const handleLeavePress = () => {
    handleClose();
    setTimeout(() => onLeave(), 300);
  };

  const handleDeleteGroup = async () => {
    try {
      await api.delete(`/groups/${group.id}`);
      disconnectGroupSocket();
      useUserStore.getState().setGroup(null);
      handleClose();
      setTimeout(onDeleted, 300);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete group');
    }
  };

  const confirmDeleteGroup = () => {
    Alert.alert(
      'Delete Group?',
      'This permanently deletes the group and removes all members. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Forever', style: 'destructive', onPress: handleDeleteGroup },
      ]
    );
  };

  const maxMembersOptions = [5, 10, 15, 20, 30, 50, 100]
    .filter((n) => n >= (group?.memberCount ?? 1))
    .map((n) => ({ label: `${n} members`, value: n }));

  if (!group) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Group Settings</Text>
          {isAdmin && hasChanges ? (
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator color={colors.accentPrimary} size="small" />
              ) : (
                <Text style={styles.saveBtn}>Save</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Group Info */}
        <Text style={styles.sectionLabel}>Group Info</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.nameInput}
            value={groupName}
            onChangeText={isAdmin ? setGroupName : undefined}
            maxLength={50}
            editable={isAdmin}
            placeholderTextColor={colors.textSecondary}
            color={colors.textPrimary}
          />
          <Text style={styles.charCount}>{groupName.length}/50</Text>
        </View>

        <View style={[styles.rowCard, { height: 64 }]}>
          <Ionicons name="earth-outline" size={18} color={colors.accentLight} />
          <View style={styles.rowLabelCol}>
            <Text style={styles.rowLabel}>Public group</Text>
            <Text style={styles.rowSubLabel}>
              {isPublic ? 'Anyone can find and join' : 'Only members with invite code can join'}
            </Text>
          </View>
          <View style={isAdmin ? undefined : styles.toggleDisabled}>
            <Switch
              value={isPublic}
              onValueChange={isAdmin ? setIsPublic : undefined}
              trackColor={{ false: colors.border, true: colors.accentPrimary }}
              thumbColor={colors.textPrimary}
              disabled={!isAdmin}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.rowCard, styles.rowSpacing]}
          onPress={isAdmin ? () => setShowMaxMembersPicker(true) : undefined}
          activeOpacity={isAdmin ? 0.7 : 1}
        >
          <Ionicons name="people-outline" size={18} color={colors.accentLight} />
          <Text style={[styles.rowLabel, { flex: 1, marginLeft: 10 }]}>Max members</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{maxMembers}</Text>
            {isAdmin ? (
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Invite Code */}
        <Text style={styles.sectionLabel}>Invite Code</Text>

        <View style={styles.codeCard}>
          <View style={styles.codeRow}>
            <Ionicons name="key-outline" size={18} color={colors.accentLight} />
            <Text style={styles.codeText}>{currentInviteCode}</Text>
            <View style={styles.codeActions}>
              <TouchableOpacity onPress={handleCopyCode} style={styles.codeIconBtn}>
                <Ionicons
                  name={codeCopied ? 'checkmark-circle' : 'copy-outline'}
                  size={22}
                  color={codeCopied ? colors.success : colors.accentLight}
                />
              </TouchableOpacity>
              {isAdmin ? (
                <TouchableOpacity onPress={confirmRegenerateCode} style={styles.codeIconBtn}>
                  {isRegenerating ? (
                    <ActivityIndicator size="small" color={colors.accentLight} />
                  ) : (
                    <Ionicons name="refresh-outline" size={22} color={colors.accentLight} />
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
        <Text style={styles.codeHint}>
          Share this code with friends to invite them to your group
        </Text>

        {/* Member count */}
        <View style={[styles.rowCard, styles.rowSpacing, { height: 52 }]}>
          <Ionicons name="people-outline" size={18} color={colors.accentLight} />
          <Text style={[styles.rowLabel, { flex: 1, marginLeft: 10 }]}>Members</Text>
          <Text style={styles.memberCountValue}>
            {group.memberCount} / {maxMembers}
          </Text>
        </View>

        {/* Error banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Danger Zone */}
        <Text style={styles.dangerLabel}>Danger Zone</Text>

        <TouchableOpacity style={styles.leaveRow} onPress={handleLeavePress}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.leaveText}>Leave Group</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.danger} style={styles.rowChevron} />
        </TouchableOpacity>

        {isAdmin ? (
          <TouchableOpacity style={[styles.deleteRow, styles.rowSpacing12]} onPress={confirmDeleteGroup}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteText}>Delete Group</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.bottomPad} />
      </Animated.View>

      <BottomSheetPicker
        visible={showMaxMembersPicker}
        title="Max Members"
        options={maxMembersOptions}
        selectedValue={maxMembers}
        onSelect={(val) => {
          setMaxMembers(val);
          setShowMaxMembersPicker(false);
        }}
        onClose={() => setShowMaxMembersPicker(false)}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  saveBtn: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: spacing.xxl,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.md,
  },
  nameInput: {
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  charCount: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xxl,
    gap: 10,
  },
  rowSpacing: {
    marginTop: spacing.md,
  },
  rowSpacing12: {
    marginTop: spacing.md,
  },
  rowLabelCol: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowSubLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowValue: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowChevron: {
    marginLeft: 'auto',
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  memberCountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  codeCard: {
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginHorizontal: spacing.xxl,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 6,
    marginLeft: 10,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  codeIconBtn: {
    padding: 4,
  },
  codeHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.sm,
  },
  errorBanner: {
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  dangerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: spacing.xxl,
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  leaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231,76,60,0.05)',
    borderRadius: radius.md,
    marginHorizontal: spacing.xxl,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 0.5,
    borderColor: colors.danger,
    gap: 10,
  },
  leaveText: {
    flex: 1,
    fontSize: 14,
    color: colors.danger,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231,76,60,0.08)',
    borderRadius: radius.md,
    marginHorizontal: spacing.xxl,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 0.5,
    borderColor: colors.danger,
    gap: 10,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  bottomPad: {
    height: 32,
  },
});
