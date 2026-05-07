import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../constraints/theme';
import supabase from '../api/supabase';

export default function AuthModal({ visible, onClose, onSuccess }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setEmail('');
    setPassword('');
    setMode('signin');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    try {
      setLoading(true);
      let session;

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          session = data.session;
        } else {
          Alert.alert(
            'Confirm your email',
            'We sent a confirmation link to your inbox. Please verify and sign in.'
          );
          handleClose();
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        session = data.session;
      }

      reset();
      onSuccess(session.access_token);
    } catch (err) {
      Alert.alert('Authentication failed', err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            <Text style={styles.toggleText}>
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xxl,
    paddingBottom: spacing.xxl + 16,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  input: {
    height: 50,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontSize: 15,
  },
  submitBtn: {
    height: 52,
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  toggleBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
