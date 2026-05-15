import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Animated,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ScrollView,
  Keyboard,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

const WIN_H = Dimensions.get('window').height;
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../constraints/theme';
import api from '../api/client';
import useUserStore from '../store/useUserStore';

const AVATAR_COLORS = [
  '#2D6BE4', '#8E44AD', '#27AE60',
  '#E74C3C', '#F39C12', '#16A085',
  '#2C3E50', '#D35400',
];

export default function EditProfileSheet({ visible, user, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [avatarColor, setAvatarColor] = useState(colors.accentPrimary);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [handleError, setHandleError] = useState(null);

  const slideAnim = useRef(new Animated.Value(700)).current;
  const [mounted, setMounted] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      if (user) {
        setName(user.name ?? '');
        setHandle(user.handle ?? '');
        setAvatarColor(user.avatarColor ?? colors.accentPrimary);
      }
      setError(null);
      setHandleError(null);
      setMounted(true);
      slideAnim.setValue(700);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 700,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const hasChanges =
    name.trim() !== (user?.name ?? '') ||
    handle.trim() !== (user?.handle ?? '') ||
    avatarColor !== (user?.avatarColor ?? colors.accentPrimary);

  const handleSave = async () => {
    if (!hasChanges || isSaving || !!handleError) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await api.patch('/users/me', {
        name: name.trim(),
        handle: handle.trim(),
        avatarColor,
      });
      const updatedUser = res.data.data.user;
      useUserStore.getState().setUser({
        name: updatedUser.name,
        handle: updatedUser.handle,
        avatarColor: updatedUser.avatarColor,
      });
      onSaved(updatedUser);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.sheet, {
          transform: [{ translateY: slideAnim }],
          height: keyboardHeight > 0 ? WIN_H - keyboardHeight - 10 : WIN_H * 0.88,
        }]}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!hasChanges || isSaving}
              style={styles.saveBtn}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.accentPrimary} />
              ) : (
                <Text style={[styles.saveText, (!hasChanges || isSaving) && styles.saveTextDisabled]}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: spacing.xl }}
          >
              {/* Avatar preview + color picker */}
              <View style={styles.avatarSection}>
                <View style={[styles.avatarPreview, {
                  backgroundColor: avatarColor,
                  shadowColor: avatarColor,
                }]}>
                  <Text style={styles.avatarInitial}>
                    {(name[0] ?? user?.name?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.changeColorLabel}>Change color</Text>

                <View style={styles.colorPalette}>
                  {AVATAR_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setAvatarColor(color)}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        avatarColor === color && styles.colorCircleSelected,
                      ]}
                    />
                  ))}
                </View>
              </View>

              {/* Display Name */}
              <Text style={styles.sectionLabel}>DISPLAY NAME</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.textSecondary}
                maxLength={50}
              />

              {/* Username */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>USERNAME</Text>
              <View style={styles.handleRow}>
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  style={styles.handleInput}
                  value={handle}
                  onChangeText={(text) => {
                    setHandle(text);
                    if (text && !/^[a-zA-Z0-9_]+$/.test(text)) {
                      setHandleError('Letters, numbers, and _ only');
                    } else {
                      setHandleError(null);
                    }
                  }}
                  placeholder="your_handle"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {handleError ? (
                <Text style={styles.handleErrorText}>{handleError}</Text>
              ) : null}

              {/* Email (read-only) */}
              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>EMAIL</Text>
              <View style={styles.emailRow}>
                <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.emailText} numberOfLines={1}>{user?.email ?? ''}</Text>
                <Text style={styles.emailFrom}>(from Google)</Text>
              </View>

              {/* Error banner */}
              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
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
  saveBtn: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 32,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  saveTextDisabled: {
    opacity: 0.35,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  avatarPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  changeColorLabel: {
    color: colors.accentLight,
    fontSize: 13,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: colors.textPrimary,
  },
  sectionLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.xxl,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xxl,
    color: colors.textPrimary,
    fontSize: 15,
  },
  handleRow: {
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    height: 52,
    marginHorizontal: spacing.xxl,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  atSign: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  handleInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    marginLeft: spacing.sm,
    height: 52,
  },
  handleErrorText: {
    color: colors.danger,
    fontSize: 12,
    marginLeft: spacing.xxl,
    marginTop: 4,
  },
  emailRow: {
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    height: 52,
    marginHorizontal: spacing.xxl,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emailText: {
    color: colors.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  emailFrom: {
    color: 'rgba(158,158,158,0.5)',
    fontSize: 11,
  },
  errorBanner: {
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderRadius: radius.md,
    marginHorizontal: spacing.xxl,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
});
