import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Switch,
  Animated, Keyboard, KeyboardAvoidingView, Platform,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../constraints/theme';
import api from '../api/client';
import BottomSheetPicker from './BottomSheetPicker';

const MAX_MEMBERS_OPTIONS = [2, 5, 10, 15, 20, 30, 50, 100].map((n) => ({
  label: String(n),
  value: n,
}));

export default function CreateGroupSheet({ visible, onClose, onCreated }) {
  const [groupName, setGroupName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [maxMembers, setMaxMembers] = useState(20);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showMembersPicker, setShowMembersPicker] = useState(false);

  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      setGroupName('');
      setIsPublic(false);
      setMaxMembers(20);
      setError(null);
      setIsSubmitting(false);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      slideAnim.setValue(500);
    }
  }, [visible]);

  const handleClose = () => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: 500,
      duration: 200,
      useNativeDriver: true,
    }).start(onClose);
  };

  const handleCreate = async () => {
    if (!groupName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/groups', {
        name: groupName.trim(),
        isPublic,
        maxMembers,
      });
      onCreated(res.data.data.group);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openMaxMembersPicker = () => setShowMembersPicker(true);

  const canCreate = groupName.trim().length > 0 && !isSubmitting;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Handle bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create Group</Text>
            <TouchableOpacity onPress={handleCreate} disabled={!canCreate}>
              {isSubmitting ? (
                <ActivityIndicator color={colors.accentPrimary} size="small" />
              ) : (
                <Text style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}>
                  Create
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Group name input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.nameInput}
              placeholder="Group name (e.g. CS Study Squad)"
              placeholderTextColor={colors.textSecondary}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
              autoFocus
              returnKeyType="done"
            />
            <Text style={styles.charCount}>{groupName.length}/50</Text>
          </View>

          {/* Privacy toggle */}
          <View style={styles.rowCard}>
            <Ionicons name="earth-outline" size={18} color={colors.accentLight} />
            <View style={styles.rowLabelCol}>
              <Text style={styles.rowLabel}>Public group</Text>
              <Text style={styles.rowSubLabel}>Anyone can find and join this group</Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: colors.border, true: colors.accentPrimary }}
              thumbColor={colors.textPrimary}
            />
          </View>

          {/* Max members row */}
          <TouchableOpacity
            style={[styles.rowCard, styles.rowCardSpacing]}
            onPress={openMaxMembersPicker}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={18} color={colors.accentLight} />
            <Text style={[styles.rowLabel, { flex: 1, marginLeft: 10 }]}>Max members</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{maxMembers}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* Info box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.accentLight} />
            <Text style={styles.infoText}>
              An invite code will be generated automatically. Share it with friends to let them join.
            </Text>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Animated.View>
      <BottomSheetPicker
        visible={showMembersPicker}
        title="Max Members"
        options={MAX_MEMBERS_OPTIONS}
        selectedValue={maxMembers}
        onSelect={setMaxMembers}
        onClose={() => setShowMembersPicker(false)}
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
    paddingBottom: 32,
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
  createBtn: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  inputContainer: {
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
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
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xxl,
    gap: 10,
  },
  rowCardSpacing: {
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0D1526',
    borderRadius: 10,
    padding: spacing.md,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.md,
    borderWidth: 0.5,
    borderColor: colors.accentPrimary,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
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
});
