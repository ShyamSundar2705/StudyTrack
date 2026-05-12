import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  Animated, Keyboard, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../constraints/theme';
import api from '../api/client';

export default function JoinGroupSheet({ visible, onClose, onJoined }) {
  const [activeTab, setActiveTab] = useState('code');
  const [inviteCode, setInviteCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isJoining, setIsJoining] = useState(null);
  const [error, setError] = useState(null);

  const slideAnim = useRef(new Animated.Value(600)).current;
  const searchTimerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setActiveTab('code');
      setInviteCode('');
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
      setIsJoining(null);
      setError(null);
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
    Keyboard.dismiss();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    Animated.timing(slideAnim, {
      toValue: 600,
      duration: 200,
      useNativeDriver: true,
    }).start(onClose);
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    setError(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimerRef.current = setTimeout(() => {
      runSearch(text);
    }, 400);
  };

  const runSearch = async (q) => {
    try {
      const res = await api.get(`/groups/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data.data.groups);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleJoinByCode = async () => {
    if (inviteCode.length < 6 || isJoining) return;
    setIsJoining('code');
    setError(null);
    try {
      const res = await api.post('/groups/join-by-code', {
        inviteCode: inviteCode.toUpperCase(),
      });
      onJoined(res.data.data.group);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired invite code');
    } finally {
      setIsJoining(null);
    }
  };

  const handleJoinFromSearch = async (group) => {
    if (isJoining) return;
    setIsJoining(group.id);
    setError(null);
    try {
      const res = await api.post(`/groups/${group.id}/join`);
      onJoined(res.data.data.group ?? group);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join group');
    } finally {
      setIsJoining(null);
    }
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
          <Text style={styles.headerTitle}>Join a Group</Text>
        </View>

        {/* Error banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'code' && styles.tabActive]}
            onPress={() => { setActiveTab('code'); setError(null); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'code' && styles.tabTextActive]}>
              Invite Code
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.tabActive]}
            onPress={() => { setActiveTab('search'); setError(null); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
              Search
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1 — Invite Code */}
        {activeTab === 'code' && (
          <View style={styles.tabContent}>
            <Text style={styles.codeInstruction}>
              Enter the 6-character code shared by your group admin
            </Text>
            <TextInput
              style={styles.codeInput}
              placeholder="ABC123"
              placeholderTextColor={colors.textSecondary}
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.joinCodeBtn, inviteCode.length < 6 && styles.joinCodeBtnDisabled]}
              onPress={handleJoinByCode}
              disabled={inviteCode.length < 6 || isJoining === 'code'}
              activeOpacity={0.8}
            >
              {isJoining === 'code' ? (
                <ActivityIndicator color={colors.textPrimary} size="small" />
              ) : (
                <Text style={styles.joinCodeBtnText}>Join Group</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Tab 2 — Search */}
        {activeTab === 'search' && (
          <View style={styles.tabContent}>
            {/* Search input */}
            <View style={styles.searchInputRow}>
              <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search public groups..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoCorrect={false}
              />
            </View>

            {/* Results area */}
            <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
              {isSearching && (
                <ActivityIndicator color={colors.accentPrimary} style={styles.searchLoader} />
              )}

              {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <View style={styles.noResults}>
                  <Text style={styles.noResultsText}>
                    No public groups found for "{searchQuery}"
                  </Text>
                  <Text style={styles.noResultsSub}>
                    Try a different name or use an invite code
                  </Text>
                </View>
              )}

              {!isSearching && searchQuery.length < 2 && (
                <View style={styles.searchEmptyState}>
                  <Ionicons name="people-outline" size={40} color={colors.border} />
                  <Text style={styles.searchEmptyText}>Search for public study groups</Text>
                </View>
              )}

              {searchResults.map((group) => (
                <View key={group.id} style={styles.resultCard}>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{group.name}</Text>
                    <Text style={styles.resultMeta}>
                      {group.memberCount} members • {group.maxMembers - group.memberCount} spots left
                    </Text>
                    <View style={styles.publicPill}>
                      <Text style={styles.publicPillText}>Public</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.joinSearchBtn}
                    onPress={() => handleJoinFromSearch(group)}
                    disabled={!!isJoining}
                    activeOpacity={0.8}
                  >
                    {isJoining === group.id ? (
                      <ActivityIndicator color={colors.textPrimary} size="small" />
                    ) : (
                      <Text style={styles.joinSearchBtnText}>Join</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
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
    paddingBottom: 32,
    maxHeight: '85%',
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
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  errorBanner: {
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceDeep,
    borderRadius: 10,
    padding: spacing.xs,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.accentPrimary,
  },
  tabText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  tabContent: {
    paddingHorizontal: spacing.xxl,
  },
  codeInstruction: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  codeInput: {
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    height: 56,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    marginBottom: spacing.lg,
  },
  joinCodeBtn: {
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.lg,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinCodeBtnDisabled: {
    opacity: 0.5,
  },
  joinCodeBtnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    height: 48,
    paddingLeft: spacing.md,
    marginBottom: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  resultsList: {
    maxHeight: 320,
  },
  searchLoader: {
    marginTop: spacing.xl,
  },
  noResults: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  noResultsText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  noResultsSub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  searchEmptyState: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  searchEmptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: spacing.sm,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  resultMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  publicPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(45,107,228,0.1)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  publicPillText: {
    fontSize: 11,
    color: colors.accentLight,
  },
  joinSearchBtn: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minWidth: 56,
    alignItems: 'center',
  },
  joinSearchBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
