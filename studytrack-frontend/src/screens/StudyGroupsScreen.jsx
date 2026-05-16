import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
// TODO: useTheme() for dynamic theme support
import { colors, radius, spacing } from '../constraints/theme';
import { getMyGroup } from '../api/users';
import { getGroupLeaderboard, leaveGroup } from '../api/leaderboard';
import { getGroupSocket, disconnectGroupSocket } from '../api/socket';
import useUserStore from '../store/useUserStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NoGroupView from '../components/NoGroupView';
import CreateGroupSheet from '../components/CreateGroupSheet';
import JoinGroupSheet from '../components/JoinGroupSheet';
import GroupSettingsSheet from '../components/GroupSettingsSheet';
import InviteMemberSheet from '../components/InviteMemberSheet';
import { fireGroupActivityNotif } from '../utils/notifications';
import api from '../api/client';


function fmtElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatActivityEvent(event, memberName) {
  const id = `${event.type}_${event.userId}_${event.createdAt}`;
  switch (event.type) {
    case 'session_start':
      return { id, name: memberName, action: 'started studying', highlight: event.subjectName || 'a subject', suffix: '', time: 'just now', badge: null };
    case 'session_complete': {
      const label = fmtDuration(event.durationSeconds || 0);
      return { id, name: memberName, action: 'completed a', highlight: `${label} session`, suffix: event.subjectName ? `on ${event.subjectName}` : '', time: 'just now', badge: null };
    }
    case 'streak_milestone':
      return { id, name: memberName, action: 'hit a', highlight: `${event.metadata?.streakCount}-day streak`, suffix: '🔥', time: 'just now', badge: 'flame' };
    default:
      return null;
  }
}

export default function StudyGroupsScreen({ navigation }) {
  const userId = useUserStore((s) => s.id);
  const insets = useSafeAreaInsets();

  const [loading,         setLoading]         = useState(true);
  const [userGroup,       setUserGroup]        = useState(null);
  const [groupId,         setGroupId]          = useState(null);
  const [groupName,       setGroupName]        = useState('Study Group');
  const [membersMap,      setMembersMap]       = useState({});
  const [leaderboard,     setLeaderboard]      = useState([]);
  const [activityFeed,    setActivityFeed]     = useState([]);
  const [showCreateSheet, setShowCreateSheet]  = useState(false);
  const [showJoinSheet,   setShowJoinSheet]    = useState(false);
  const [codeCopied,      setCodeCopied]       = useState(false);
  const [isAdmin,           setIsAdmin]          = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showInviteSheet,   setShowInviteSheet]   = useState(false);
  const [showDiscoverSheet, setShowDiscoverSheet] = useState(false);
  const [groupNotifsEnabled, setGroupNotifsEnabled] = useState(false);

  // Keep a ref to membersMap so socket callbacks can read the latest values
  const membersMapRef = useRef({});
  useEffect(() => { membersMapRef.current = membersMap; }, [membersMap]);

  const fetchUserGroup = async () => {
    setLoading(true);
    try {
      const resp = await getMyGroup();
      const group = resp?.data?.group;
      if (!group) { setUserGroup(null); return; }

      setUserGroup(group);
      setGroupId(group.id);
      setGroupName(group.name);

      const initialMap = {};
      for (const m of (group.members ?? [])) {
        initialMap[m.userId] = {
          userId: m.userId,
          name: m.name,
          todaySeconds: m.todaySeconds ?? 0,
          status: 'idle',
          subjectName: '',
          elapsedSeconds: 0,
        };
      }
      setMembersMap(initialMap);
      const currentMember = (group.members ?? []).find(m => m.userId === userId);
      setIsAdmin(currentMember?.isAdmin ?? false);
    } catch (err) {
      if (err.response?.status === 404) setUserGroup(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserGroup();
    const prefs = useUserStore.getState().preferences;
    setGroupNotifsEnabled(prefs?.groupActivityAlerts ?? true);
  }, []);

  const handleGroupCreated = (group) => {
    setUserGroup(group);
    setGroupId(group.id);
    setGroupName(group.name);
    setMembersMap({});
    setIsAdmin(true);
    useUserStore.getState().setGroup(group);
  };

  const handleGroupJoined = (group) => {
    setUserGroup(group);
    setGroupId(group.id);
    setGroupName(group.name ?? 'Study Group');
    setMembersMap({});
    setIsAdmin(false);
    useUserStore.getState().setGroup(group);
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(userGroup?.inviteCode ?? '');
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleLeaveGroup = () => {
    const memberCount = Object.keys(membersMap).length;
    Alert.alert(
      'Leave Group?',
      isAdmin && memberCount > 1
        ? 'You are the admin. Admin role will be transferred to the next oldest member.'
        : memberCount === 1
          ? 'You are the only member. Leaving will delete the group.'
          : 'You will lose access to this group and its leaderboard.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(groupId);
              disconnectGroupSocket();
              setUserGroup(null);
              setGroupId(null);
              setGroupName('Study Group');
              setMembersMap({});
              setLeaderboard([]);
              setActivityFeed([]);
              setIsAdmin(false);
              useUserStore.getState().setGroup(null);
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error ?? 'Could not leave group.');
            }
          },
        },
      ]
    );
  };

  const handleGroupUpdated = (updatedGroup) => {
    setUserGroup((prev) => ({ ...prev, ...updatedGroup }));
    setGroupName(updatedGroup.name);
    useUserStore.getState().setGroup({ ...useUserStore.getState().group, ...updatedGroup });
  };

  const handleGroupDeleted = () => {
    disconnectGroupSocket();
    setUserGroup(null);
    setGroupId(null);
    setGroupName('Study Group');
    setMembersMap({});
    setLeaderboard([]);
    setActivityFeed([]);
    setIsAdmin(false);
  };

  // Load leaderboard helper — also called on leaderboard_update socket event
  const fetchLeaderboard = async (gid) => {
    try {
      const data = await getGroupLeaderboard(gid, 'today');
      setLeaderboard(data);
    } catch (_) {}
  };

  // Connect socket once groupId is available
  useEffect(() => {
    if (!groupId || !userId) return;

    fetchLeaderboard(groupId);

    const socket = getGroupSocket();
    socket.connect();
    socket.emit('join_group_room', { groupId, userId });

    const onMemberStatus = ({ userId: uid, status, subjectName, elapsedSeconds }) => {
      setMembersMap((prev) => ({
        ...prev,
        [uid]: {
          ...prev[uid],
          status,
          subjectName: subjectName ?? prev[uid]?.subjectName ?? '',
          elapsedSeconds: elapsedSeconds ?? 0,
        },
      }));
    };

    const onActivityFeed = (event) => {
      const name = membersMapRef.current[event.userId]?.name ?? 'Someone';
      const entry = formatActivityEvent(event, name);
      if (!entry) return;
      setActivityFeed((prev) => [entry, ...prev].slice(0, 20));

      if (groupNotifsEnabled && event.userId !== useUserStore.getState().id) {
        fireGroupActivityNotif({
          type: event.type,
          memberName: name,
          subjectName: event.subjectName,
          durationSeconds: event.durationSeconds,
          streakCount: event.metadata?.streakCount,
        });
      }
    };

    const onLeaderboardUpdate = () => fetchLeaderboard(groupId);

    const onGroupDeleted = ({ message }) => {
      Alert.alert('Group Deleted', message);
      handleGroupDeleted();
    };

    socket.on('member_status_update', onMemberStatus);
    socket.on('activity_feed_update', onActivityFeed);
    socket.on('leaderboard_update', onLeaderboardUpdate);
    socket.on('group_deleted', onGroupDeleted);

    return () => {
      socket.emit('leave_group_room', { groupId });
      socket.off('member_status_update', onMemberStatus);
      socket.off('activity_feed_update', onActivityFeed);
      socket.off('leaderboard_update', onLeaderboardUpdate);
      socket.off('group_deleted', onGroupDeleted);
    };
  }, [groupId, userId]);

  const handleToggleGroupNotifs = async () => {
    const newValue = !groupNotifsEnabled;
    setGroupNotifsEnabled(newValue);
    try {
      await api.patch('/users/me/preferences', { groupActivityAlerts: newValue });
      useUserStore.getState().setPreferences({ groupActivityAlerts: newValue });
    } catch (err) {
      setGroupNotifsEnabled(!newValue);
    }
    if (newValue) {
      Alert.alert(
        '🔔 Group notifications on',
        "You'll be notified when members start or complete sessions.",
        [{ text: 'OK' }]
      );
    }
  };

  // Derived data
  const studyingMembers = Object.values(membersMap).filter((m) => m.status === 'studying');
  const maxLbSeconds = leaderboard[0]?.durationSeconds || 1;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerLeft}>
            <Ionicons name="people-outline" size={24} color={colors.accentPrimary} />
            <Text style={styles.headerTitle}>Groups</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="person-add-outline" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.accentPrimary} size="large" />
        </View>
      </View>
    );
  }

  // ── No group empty state ───────────────────────────────────────────────────
  if (!userGroup) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerLeft}>
            <Ionicons name="people-outline" size={24} color={colors.accentPrimary} />
            <Text style={styles.headerTitle}>Groups</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowJoinSheet(true)}>
              <Ionicons name="person-add-outline" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
        <NoGroupView
          onCreateGroup={() => setShowCreateSheet(true)}
          onJoinGroup={() => setShowJoinSheet(true)}
        />
        <CreateGroupSheet
          visible={showCreateSheet}
          onClose={() => setShowCreateSheet(false)}
          onCreated={handleGroupCreated}
        />
        <JoinGroupSheet
          visible={showJoinSheet}
          onClose={() => setShowJoinSheet(false)}
          onJoined={handleGroupJoined}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="people-outline" size={24} color={colors.accentPrimary} />
          <Text style={styles.headerTitle}>Groups</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowInviteSheet(true)}
          >
            <Ionicons name="person-add-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { marginLeft: spacing.sm }]}
            onPress={handleToggleGroupNotifs}
          >
            <Ionicons
              name={groupNotifsEnabled ? 'notifications' : 'notifications-outline'}
              size={22}
              color={groupNotifsEnabled ? colors.accentPrimary : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Group Header Card */}
        <View style={styles.groupCard}>
          <View style={styles.groupCardTop}>
            <View>
              <Text style={styles.groupName}>{groupName}</Text>
              <Text style={styles.groupMeta}>{Object.keys(membersMap).length} members</Text>
            </View>
            <View style={styles.groupCardActions}>
              <TouchableOpacity style={styles.manageBtn} onPress={() => setShowSettingsSheet(true)}>
                <Text style={styles.manageBtnText}>Manage</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveGroup}>
                <Ionicons name="exit-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 3-col stats */}
          <View style={styles.groupStats}>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>{studyingMembers.length}</Text>
              <Text style={styles.statLabel}>Studying now</Text>
            </View>
            <View style={[styles.statCol, styles.statColBordered]}>
              <Text style={styles.statValue}>
                {fmtDuration(leaderboard.reduce((sum, e) => sum + (e.durationSeconds || 0), 0))}
              </Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>#—</Text>
              <Text style={styles.statLabel}>Global Rank</Text>
            </View>
          </View>

          {/* Invite code row */}
          {userGroup?.inviteCode ? (
            <TouchableOpacity
              style={styles.inviteCodeRow}
              onPress={handleCopyCode}
              activeOpacity={0.7}
            >
              <Text style={styles.inviteCodeLabel}>
                Invite code: <Text style={styles.inviteCodeValue}>{userGroup.inviteCode}</Text>
              </Text>
              <Ionicons
                name={codeCopied ? 'checkmark-circle' : 'copy-outline'}
                size={14}
                color={codeCopied ? colors.success : colors.accentLight}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Studying Now */}
        <Text style={styles.sectionTitle}>Studying Now</Text>
        {studyingMembers.length === 0 ? (
          <Text style={styles.emptySection}>No one is studying right now.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeMembersRow}
          >
            {studyingMembers.map((m) => (
              <View key={m.userId} style={styles.activeMemberCard}>
                <View style={styles.avatarGlowRing}>
                  <View style={styles.avatarCircle}>
                    <Ionicons name="person" size={22} color={colors.textSecondary} />
                  </View>
                  <View style={styles.onlineDot} />
                </View>
                <Text style={styles.activeMemberName}>{m.name}</Text>
                <Text style={styles.activeMemberTime}>{fmtElapsed(m.elapsedSeconds)}</Text>
                <Text style={styles.activeMemberSubject} numberOfLines={2}>
                  {m.subjectName || '—'}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Top Contributors */}
        <Text style={styles.sectionTitle}>Top Contributors</Text>
        <View style={styles.contributorsCard}>
          {leaderboard.slice(0, 5).map((entry, idx) => (
            <View key={entry.userId} style={[styles.contributorRow, idx < Math.min(leaderboard.length, 5) - 1 && styles.contributorRowBorder]}>
              <Text style={styles.contributorRank}>#{entry.rank}</Text>
              <View style={styles.contributorAvatarCircle}>
                <Text style={styles.initialsText}>{entry.avatarInitial}</Text>
              </View>
              <View style={styles.contributorInfo}>
                <View style={styles.contributorNameRow}>
                  <Text style={styles.contributorName}>{entry.name}</Text>
                  <Text style={styles.contributorTime}>{fmtDuration(entry.durationSeconds)}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round((entry.durationSeconds / maxLbSeconds) * 100)}%` }]} />
                </View>
              </View>
            </View>
          ))}
          {leaderboard.length === 0 && (
            <Text style={[styles.emptySection, { paddingVertical: spacing.lg }]}>No data yet today.</Text>
          )}
        </View>

        {/* Activity Feed */}
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.activityCard}>
          {activityFeed.length > 0 && <View style={styles.timelineLine} />}
          {activityFeed.length === 0 && (
            <Text style={[styles.emptySection, { paddingVertical: spacing.lg }]}>No recent activity.</Text>
          )}
          {activityFeed.map((item, idx) => (
            <View key={item.id} style={[styles.activityRow, idx < activityFeed.length - 1 && styles.activityRowSpacing]}>
              <View style={styles.activityAvatarRing}>
                <View style={styles.activityAvatarCircle}>
                  <Ionicons name="person" size={16} color={colors.textSecondary} />
                </View>
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  <Text style={styles.activityName}>{item.name} </Text>
                  <Text>{item.action} </Text>
                  <Text style={styles.activityHighlight}>{item.highlight}</Text>
                  {item.suffix ? <Text> {item.suffix}</Text> : null}
                </Text>
                <View style={styles.activityMeta}>
                  <Text style={styles.activityTime}>{item.time}</Text>
                  {item.badge === 'flame' && (
                    <View style={styles.flameBadge}>
                      <Ionicons name="flame" size={12} color={colors.warning} />
                      <Text style={styles.flameBadgeText}>Streak</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Discover Banner */}
        <TouchableOpacity
          style={styles.discoverBanner}
          activeOpacity={0.85}
          onPress={() => setShowDiscoverSheet(true)}
        >
          <Ionicons name="compass-outline" size={22} color={colors.accentPrimary} />
          <View style={[styles.discoverLeft, { marginLeft: 12 }]}>
            <Text style={styles.discoverTitle}>Find a new group</Text>
            <Text style={styles.discoverSub}>Browse public study groups by subject</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.accentPrimary} />
        </TouchableOpacity>
      </ScrollView>

      <CreateGroupSheet
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onCreated={handleGroupCreated}
      />
      <JoinGroupSheet
        visible={showJoinSheet}
        onClose={() => setShowJoinSheet(false)}
        onJoined={handleGroupJoined}
      />
      <GroupSettingsSheet
        visible={showSettingsSheet}
        group={userGroup ? { ...userGroup, memberCount: Object.keys(membersMap).length } : null}
        isAdmin={isAdmin}
        onClose={() => setShowSettingsSheet(false)}
        onUpdated={handleGroupUpdated}
        onDeleted={handleGroupDeleted}
        onLeave={handleLeaveGroup}
      />
      <InviteMemberSheet
        visible={showInviteSheet}
        group={userGroup}
        onClose={() => setShowInviteSheet(false)}
      />
      <JoinGroupSheet
        visible={showDiscoverSheet}
        initialTab="search"
        onClose={() => setShowDiscoverSheet(false)}
        onJoined={handleGroupJoined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentPrimary,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xl },

  /* Empty states */
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  emptySection: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  /* Section title */
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  /* Group header card */
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  groupCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  groupMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  groupCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  manageBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manageBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  leaveBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupStats: {
    flexDirection: 'row',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statColBordered: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  inviteCodeLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  inviteCodeValue: {
    color: colors.accentLight,
    fontWeight: '700',
    letterSpacing: 2,
  },

  /* Active members horizontal scroll */
  activeMembersRow: {
    paddingRight: spacing.xl,
    gap: spacing.md,
  },
  activeMemberCard: {
    width: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarGlowRing: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  activeMemberName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activeMemberTime: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentPrimary,
    marginBottom: 4,
  },
  activeMemberSubject: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  /* Top contributors */
  contributorsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  contributorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  contributorRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contributorRank: {
    width: 28,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  contributorAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  initialsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  contributorInfo: {
    flex: 1,
  },
  contributorNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  contributorName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  contributorTime: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.surfaceDeep,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
    borderRadius: 2,
  },

  /* Activity feed */
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: spacing.xl + 19,
    top: spacing.xl + 24,
    bottom: spacing.xl,
    width: 2,
    backgroundColor: colors.border,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityRowSpacing: {
    marginBottom: spacing.xl,
  },
  activityAvatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.background,
    backgroundColor: colors.background,
    marginRight: spacing.md,
    zIndex: 1,
  },
  activityAvatarCircle: {
    flex: 1,
    borderRadius: 17,
    backgroundColor: colors.surfaceDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
    paddingTop: 2,
  },
  activityText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  activityName: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activityHighlight: {
    fontWeight: '600',
    color: colors.accentPrimary,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  flameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    gap: 3,
  },
  flameBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warning,
  },

  /* Discover banner */
  discoverBanner: {
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceBlue,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.accentPrimary,
  },
  discoverLeft: {
    flex: 1,
  },
  discoverTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accentLight,
    marginBottom: 4,
  },
  discoverSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
